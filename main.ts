import { IRdsOutput, setupRds } from "./components/rds";
import { IVPCOutput, setupVPC } from "./components/vpc";
import { setupS3Bucket } from "./components/s3-bucket";
import { AwsProvider } from "@cdktf/provider-aws";
import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { setupEcsService } from "./components/ecs";
import { setupSupertokensLBListener } from "./components/load-balancer-listerner-rule";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs";

interface BaseStackOutput {
  rdsOutput: IRdsOutput;
  vpcOutput: IVPCOutput;
  ecsCluster: EcsCluster;
}

const ProjectName = "bmx";

// S3 Buckets for Frontend projects
class ProjectStack extends TerraformStack {
  //#region "Variables"
  private readonly _projectName = ProjectName;
  private readonly _acmCertificateArn =
    "arn:aws:acm:us-east-1:864736175158:certificate/9e0f3cc3-500f-4d49-a246-6884e2f43044";
  private readonly _dbPassword = "1zkJ3TaIr8VmnzoY";
  private readonly _hostedZoneId = "Z02578703SJZ5HLD246MH";
  private readonly _profile = "rhdev";
  private readonly _domainName = "fastflow.app";

  //#endregion "Variables"

  setupBaseStacks(tags: { [key: string]: string }): BaseStackOutput {
    const vpcOutput = setupVPC(this, {
      vpcName: "bmx-vpc",
      domainName: this._domainName,
      tags,
    });

    const rdsOutput = setupRds(this, {
      privateSubnetGroupName: vpcOutput.privateSubnetGroupName,
      vpcSecurityGroupIds: vpcOutput.vpcSecurityGroupIds,
      rdsClusterName: "bmx-rds",
      // db for other environments would require a manual setup
      databaseName: this._projectName + "_dev",
      databasePassword: this._dbPassword,
      tags: tags,
    });

    const ecsCluster = new EcsCluster(this, "bmx-ecs-cluster", {
      name: "bmx-ecs-cluster",
      tags: tags,
    });

    return {
      vpcOutput,
      rdsOutput,
      ecsCluster,
    };
  }

  setupEnvironment(environment: string, baseStackOutput: BaseStackOutput) {
    const tags = {
      "roadhouse:client": "bmx",
      "roadhouse:environment-type": environment,
    };
    console.log("Terraforming: " + this._projectName + "-" + environment);

    // set up VPC
    let vpcOutput = baseStackOutput.vpcOutput;

    // set up supertokens load balancer listeners
    const supertokensLBListenerOutput = setupSupertokensLBListener(this, {
      vpcId: vpcOutput.vpcId,
      loadBalancerHttpsListenerArn: vpcOutput.loadBalancerHttpsListenerArn,
      tags,
      environment,
      projectName: this._projectName,
    });

    // set up S3 bucket for React Admin frontend
    setupS3Bucket(this, {
      bucketName: "bmx-admin-" + environment,
      hostedZoneId: this._hostedZoneId,
      alternativeDomainName: `${environment}-admin.fastflow.app`,
      acmCertificateArn: this._acmCertificateArn,
      enableCors: false,
      tags,
    });

    // set up S3 bucket for assets
    setupS3Bucket(this, {
      bucketName: `bmx-${environment}-assets`,
      hostedZoneId: this._hostedZoneId,
      alternativeDomainName: `${environment}-assets.fastflow.app`,
      acmCertificateArn: this._acmCertificateArn,
      enableCors: true,
      tags,
    });

    // set up RDS
    let rdsOutput = baseStackOutput.rdsOutput;

    setupEcsService(this, {
      ecsCluster: baseStackOutput.ecsCluster,
      ecsServiceName: "bmx-ecs-" + environment,
      dbCluster: rdsOutput.dbCluster,
      ecsSecurityGroupIds: vpcOutput.ecsSecurityGroupIds,
      privateSubnetIds: vpcOutput.privateSubnetIds,
      adminSupertokensTargetGroup:
        supertokensLBListenerOutput.adminSupertokensTargetGroup,
      supertokensTargetGroup:
        supertokensLBListenerOutput.supertokensTargetGroup,
      environment,
      tags,
    });
  }

  constructor(scope: Construct, name: string) {
    super(scope, name);
    // provider settings
    new AwsProvider(this, "aws", {
      region: "ap-southeast-2",
      profile: this._profile,
    });

    const baseStackOutput = this.setupBaseStacks({
      "roadhouse:client": this._projectName,
      "roadhouse:environment-type": "all",
    });

    this.setupEnvironment("dev", baseStackOutput);
    this.setupEnvironment("stage", baseStackOutput);
  }
}

const app = new App();

new ProjectStack(app, ProjectName + "-stack");

app.synth();
