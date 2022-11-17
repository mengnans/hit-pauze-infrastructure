import { RdsCluster } from "@cdktf/provider-aws/lib/rds";

export interface IRdsBaseStackProps {
  privateSubnetGroupName: string;
  vpcSecurityGroupIds: string[];
}

interface IRdsStackProps extends IRdsBaseStackProps {
  rdsClusterName: string;
  databaseName: string;
  databasePassword: string;
  tags: { [key: string]: string };
}

export interface IRdsOutput {
  dbCluster: RdsCluster;
}

export const setupRds = (self: any, props: IRdsStackProps): IRdsOutput => {
  // RDS AURORA MODULE
  const dbCluster = new RdsCluster(self, `${props.rdsClusterName}-aurora`, {
    engine: "aurora-postgresql",
    engineVersion: "11.13",
    databaseName: props.databaseName,
    availabilityZones: [
      "ap-southeast-2a",
      "ap-southeast-2b",
      "ap-southeast-2c",
    ],
    port: 5432,
    clusterIdentifier: `${props.rdsClusterName}-cluster`,
    enableHttpEndpoint: true,
    engineMode: "serverless",
    scalingConfiguration: {
      minCapacity: 2,
      maxCapacity: 8,
      autoPause: true,
      secondsUntilAutoPause: 5 * 60,
    },
    skipFinalSnapshot: true,
    vpcSecurityGroupIds: props.vpcSecurityGroupIds,
    dbSubnetGroupName: props.privateSubnetGroupName,
    masterUsername: "postgres",
    masterPassword: props.databasePassword,
    tags: {
      Name: props.rdsClusterName,
      ...props.tags,
    },
  });

  return {
    dbCluster,
  };
};
