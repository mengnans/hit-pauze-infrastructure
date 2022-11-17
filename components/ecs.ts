import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch";
import {
  EcsCluster,
  EcsService,
  EcsTaskDefinition,
} from "@cdktf/provider-aws/lib/ecs";
import { LbTargetGroup } from "@cdktf/provider-aws/lib/elb";
import {
  DataAwsIamPolicyDocument,
  IamRole,
  IamRolePolicyAttachment,
} from "@cdktf/provider-aws/lib/iam";
import { RdsCluster } from "@cdktf/provider-aws/lib/rds";

interface IEcsStackProps {
  ecsServiceName: string;
  dbCluster: RdsCluster;
  ecsCluster: EcsCluster;
  adminSupertokensTargetGroup: LbTargetGroup;
  supertokensTargetGroup: LbTargetGroup;
  ecsSecurityGroupIds: string[];
  privateSubnetIds: string[];
  environment: string;
  tags: { [key: string]: string };
}

export const setupEcsService = (self: any, props: IEcsStackProps) => {
  const superTokensLogGroup = new CloudwatchLogGroup(
    self,
    `${props.ecsServiceName}-supertokens-log-group`,
    {
      retentionInDays: 1,
      name: `/bmx/ecs/${props.environment}/supertokens/`,
    }
  );

  const adminSuperTokensLogGroup = new CloudwatchLogGroup(
    self,
    `${props.ecsServiceName}-admin-supertokens-log-group`,
    {
      retentionInDays: 1,
      name: `/bmx/ecs/${props.environment}/admin-supertokens/`,
    }
  );

  const taskAssumeRole = new DataAwsIamPolicyDocument(
    self,
    `${props.ecsServiceName}-task-assume-role`,
    {
      statement: [
        {
          actions: ["sts:AssumeRole"],
          principals: [
            {
              type: "Service",
              identifiers: ["ecs-tasks.amazonaws.com"],
            },
          ],
        },
      ],
    }
  );

  const taskExecutionRole = new IamRole(
    self,
    `${props.ecsServiceName}-task-execution-role`,
    {
      name: `${props.ecsServiceName}-task-execution-role`,
      assumeRolePolicy: taskAssumeRole.json,
      tags: props.tags,
    }
  );

  // Normally we'd prefer not to hardcode an ARN in our Terraform, but since this is
  // an AWS-managed policy, it's okay.
  new IamRolePolicyAttachment(
    self,
    `${props.ecsServiceName}-task-execution-role-policy-attachment`,
    {
      role: taskExecutionRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    }
  );

  // ECS TASK DEFINITIONS
  const coreServiceTaskDefinition = new EcsTaskDefinition(
    self,
    `bmx-${props.environment}-core-services-task-definition`,
    {
      family: `${props.ecsServiceName}`,
      executionRoleArn: taskExecutionRole.arn,
      cpu: "2048",
      tags: props.tags,
      memory: "4096",
      requiresCompatibilities: ["FARGATE"],
      networkMode: "awsvpc",
      containerDefinitions: JSON.stringify([
        {
          name: "supertokens",
          image: "registry.supertokens.io/supertokens/supertokens-postgresql",
          essential: true,
          environment: [
            {
              name: "SUPERTOKENS_PORT",
              value: "3568",
            },
            {
              name: "POSTGRESQL_USER",
              value: props.dbCluster.masterUsername,
            },
            {
              name: "POSTGRESQL_PASSWORD",
              value: props.dbCluster.masterPassword,
            },
            {
              name: "POSTGRESQL_HOST",
              value: props.dbCluster.endpoint,
            },
            {
              name: "POSTGRESQL_PORT",
              value: `${props.dbCluster.port}`,
            },
            {
              name: "POSTGRESQL_DATABASE_NAME",
              value: `bmx_supertokens_${props.environment}`,
            },
            {
              name: "API_KEYS",
              value: "D84DUf4I0UqEOZmVsHHUGq4rW05jhyYZTY7LyQHr",
            },
          ],
          memoryReservation: 2048,
          portMappings: [
            {
              containerPort: 3568,
            },
          ],

          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": superTokensLogGroup.name,
              "awslogs-region": "ap-southeast-2",
              "awslogs-stream-prefix": "ecs",
            },
          },
        },
        {
          name: "admin-supertokens",
          image: "registry.supertokens.io/supertokens/supertokens-postgresql",
          essential: true,
          environment: [
            {
              name: "SUPERTOKENS_PORT",
              value: "3567",
            },
            {
              name: "POSTGRESQL_USER",
              value: props.dbCluster.masterUsername,
            },
            {
              name: "POSTGRESQL_PASSWORD",
              value: props.dbCluster.masterPassword,
            },
            {
              name: "POSTGRESQL_HOST",
              value: props.dbCluster.endpoint,
            },
            {
              name: "POSTGRESQL_PORT",
              value: `${props.dbCluster.port}`,
            },
            {
              name: "POSTGRESQL_DATABASE_NAME",
              value: `bmx_admin_supertokens_${props.environment}`,
            },
            {
              name: "API_KEYS",
              value: "r4AOroA2cV5K8DuRaJB3jPgOe18ckeHnTQv45VLR",
            },
          ],
          memoryReservation: 2048,
          portMappings: [
            {
              containerPort: 3567,
            },
          ],

          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": adminSuperTokensLogGroup.name,
              "awslogs-region": "ap-southeast-2",
              "awslogs-stream-prefix": "ecs",
            },
          },
        },
      ]),
    }
  );

  // ECS SERVICES
  new EcsService(self, `bmx-${props.environment}-core-services`, {
    name: `bmx-${props.environment}-core-services`,
    taskDefinition: coreServiceTaskDefinition.arn,
    cluster: props.ecsCluster.id,
    tags: props.tags,
    launchType: "FARGATE",
    loadBalancer: [
      {
        targetGroupArn: props.adminSupertokensTargetGroup.arn,
        containerName: "admin-supertokens",
        containerPort: 3567,
      },
      {
        targetGroupArn: props.supertokensTargetGroup.arn,
        containerName: "supertokens",
        containerPort: 3568,
      },
    ],
    desiredCount: 1,
    networkConfiguration: {
      assignPublicIp: false,
      securityGroups: props.ecsSecurityGroupIds,
      subnets: props.privateSubnetIds,
    },
  });
};
