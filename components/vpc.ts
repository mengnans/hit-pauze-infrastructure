// eslint-disable @typescript-eslint/no-unused-vars
import {
  InternetGateway,
  NatGateway,
  Route,
  RouteTable,
  RouteTableAssociation,
  SecurityGroup,
  Subnet,
  Vpc,
} from "@cdktf/provider-aws/lib/vpc";
import { Lb, LbListener } from "@cdktf/provider-aws/lib/elb";
import { DbSubnetGroup } from "@cdktf/provider-aws/lib/rds";
import { IRdsBaseStackProps } from "./rds";
import { ec2 } from "@cdktf/provider-aws";
import { AcmCertificate } from "@cdktf/provider-aws/lib/acm";

interface IVPCStackProps {
  vpcName: string;
  domainName: string;
  tags: { [key: string]: string };
}

export interface IVPCOutput extends IRdsBaseStackProps {
  ecsSecurityGroupIds: string[];
  privateSubnetIds: string[];
  vpcId: string;
  loadBalancerHttpsListenerArn: string;
}

export const setupVPC = (self: any, props: IVPCStackProps): IVPCOutput => {
  // THE VPC
  const vpc = new Vpc(self, props.vpcName, {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
      Name: props.vpcName,
      ...props.tags,
    },
  });

  // PUBLIC SUBNETS
  const publicSubnetA = new Subnet(self, `${props.vpcName}-public-subnet-a`, {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/25",
    availabilityZone: "ap-southeast-2a",
    tags: {
      Name: `${props.vpcName}-public-subnet-a | ap-southeast-2a`,
      ...props.tags,
    },
  });

  const publicSubnetB = new Subnet(self, `${props.vpcName}-public-subnet-b`, {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.128/25",
    availabilityZone: "ap-southeast-2b",
    tags: {
      Name: `${props.vpcName}-public-subnet-b | ap-southeast-2b`,
      ...props.tags,
    },
  });

  // PRIVATE SUBNETS
  const privateSubnetA = new Subnet(self, `${props.vpcName}-private-subnet-a`, {
    vpcId: vpc.id,
    cidrBlock: "10.0.2.0/25",
    availabilityZone: "ap-southeast-2a",
    tags: {
      Name: `${props.vpcName}-private-subnet-a | ap-southeast-2a`,
      ...props.tags,
    },
  });

  const privateSubnetB = new Subnet(self, `${props.vpcName}-private-subnet-b`, {
    vpcId: vpc.id,
    cidrBlock: "10.0.2.128/25",
    availabilityZone: "ap-southeast-2b",
    tags: {
      Name: `${props.vpcName}-private-subnet-b | ap-southeast-2b`,
      ...props.tags,
    },
  });

  // ROUTE TABLES
  const publicRouteTable = new RouteTable(
    self,
    `${props.vpcName}-public-route-table`,
    {
      vpcId: vpc.id,
      tags: {
        Name: `${props.vpcName}-public-route-table`,
        ...props.tags,
      },
    }
  );

  const privateRouteTable = new RouteTable(
    self,
    `${props.vpcName}-private-route-table`,
    {
      vpcId: vpc.id,
      tags: {
        Name: `${props.vpcName}-private-route-table`,
        ...props.tags,
      },
    }
  );

  // PUBLIC ROUTE TABLE ASSOCIATIONS
  new RouteTableAssociation(
    self,
    `${props.vpcName}-public-route-table-association-a`,
    {
      subnetId: publicSubnetA.id,
      routeTableId: publicRouteTable.id,
    }
  );

  new RouteTableAssociation(
    self,
    `${props.vpcName}-public-route-table-association-b`,
    {
      subnetId: publicSubnetB.id,
      routeTableId: publicRouteTable.id,
    }
  );

  // PRIVATE ROUTE TABLE ASSOCIATIONS
  new RouteTableAssociation(
    self,
    `${props.vpcName}-private-route-table-association-a`,
    {
      subnetId: privateSubnetA.id,
      routeTableId: privateRouteTable.id,
    }
  );

  new RouteTableAssociation(
    self,
    `${props.vpcName}-private-route-table-association-b`,
    {
      subnetId: privateSubnetB.id,
      routeTableId: privateRouteTable.id,
    }
  );

  // ELASTIC IP
  const eipA = new ec2.Eip(self, `${props.vpcName}-elastic-ip-a`, {
    tags: {
      Name: `${props.vpcName}-eip-a`,
      ...props.tags,
    },
  });

  const eipB = new ec2.Eip(self, `${props.vpcName}-elastic-ip-b`, {
    tags: {
      Name: `${props.vpcName}-eip-b`,
      ...props.tags,
    },
  });

  // INTERNET GATEWAY
  const igw = new InternetGateway(self, `${props.vpcName}-internet-gateway`, {
    vpcId: vpc.id,
    tags: {
      Name: `${props.vpcName}-internet-gateway`,
      ...props.tags,
    },
  });

  // NAT GATEWAY A
  const ngwA = new NatGateway(
    self,
    `${props.vpcName}-public-subnet-a-nat-gateway`,
    {
      subnetId: publicSubnetA.id,
      allocationId: eipA.id,
      dependsOn: [igw],
      tags: {
        Name: `${props.vpcName}-nat-gateway-a`,
        ...props.tags,
      },
    }
  );

  // NAT GATEWAY B
  const ngwB = new NatGateway(
    self,
    `${props.vpcName}-public-subnet-b-nat-gateway`,
    {
      subnetId: publicSubnetB.id,
      allocationId: eipB.id,
      dependsOn: [igw],
      tags: {
        Name: `${props.vpcName}-nat-gateway-b`,
        ...props.tags,
      },
    }
  );

  //PUBLIC ROUTES TO THE INTERNET GATEWAY
  new Route(self, `${props.vpcName}-public-igw-route`, {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: igw.id,
  });

  //PRIVATE ROUTES TO THE NAT GATEWAY
  new Route(self, `${props.vpcName}-private-ngw-a-route`, {
    routeTableId: privateRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    natGatewayId: ngwA.id,
  });

  //PRIVATE ROUTES TO THE NAT GATEWAY
  new Route(self, `${props.vpcName}-private-ngw-b-route`, {
    routeTableId: privateRouteTable.id,
    destinationCidrBlock: "0.0.0.0/8",
    natGatewayId: ngwB.id,
  });

  // DB SUBNET GROUP
  const privateSubnetGroup = new DbSubnetGroup(
    self,
    `${props.vpcName}-private-subnet-group`,
    {
      subnetIds: [privateSubnetA.id, privateSubnetB.id],
      tags: props.tags,
    }
  );

  const ingressAllSecurityGroup = new SecurityGroup(
    self,
    `${props.vpcName}-security-group-ingress-all`,
    {
      name: `${props.vpcName}-security-group-ingress-all`,
      description: "All ingress traffic",
      vpcId: vpc.id,
      tags: props.tags,
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    }
  );

  const egressAllSecurityGroup = new SecurityGroup(
    self,
    `${props.vpcName}-security-group-egress-all`,
    {
      name: `${props.vpcName}-security-group-egress-all`,
      description: "All egress traffic",
      vpcId: vpc.id,
      tags: props.tags,
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    }
  );

  const dbClusterIngressSecurityGroup = new SecurityGroup(
    self,
    `${props.vpcName}-security-group-db-cluster-ingress`,
    {
      name: `${props.vpcName}-security-group-db-cluster-ingress`,
      description: "Allow ingress to db cluster",
      vpcId: vpc.id,
      tags: props.tags,
      ingress: [
        {
          fromPort: 5432,
          toPort: 5432,
          protocol: "TCP",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    }
  );

  const vpcLoadBalancer = new Lb(self, `${props.vpcName}-load-balancer`, {
    name: `${self._projectName}-load-balancer`,
    internal: false,
    loadBalancerType: "application",
    tags: props.tags,
    subnets: [publicSubnetA.id, publicSubnetB.id],
    securityGroups: [egressAllSecurityGroup.id, ingressAllSecurityGroup.id],
  });

  // http listener
  new LbListener(self, `${self._projectName}-load-balancer-http-listener`, {
    loadBalancerArn: vpcLoadBalancer.arn,
    port: 80,
    protocol: "HTTP",
    tags: props.tags,
    defaultAction: [
      {
        type: "redirect",
        redirect: {
          protocol: "HTTPS",
          port: "443",
          statusCode: "HTTP_301",
        },
      },
    ],
  });

  const defaultCertificate = new AcmCertificate(
    self,
    `${props.vpcName}-load-balancer-default-certificate`,
    {
      domainName: `*.${props.domainName}`,
      tags: props.tags,
      validationMethod: "DNS",
      lifecycle: {
        createBeforeDestroy: true,
      },
    }
  );

  // https listener
  const loadBalancerHttpsListener = new LbListener(
    self,
    `${self._projectName}-load-balancer-https-listener`,
    {
      loadBalancerArn: vpcLoadBalancer.arn,
      port: 443,
      protocol: "HTTPS",
      tags: props.tags,
      certificateArn: defaultCertificate.arn,
      defaultAction: [
        {
          type: "fixed-response",
          fixedResponse: {
            contentType: "text/html",
            messageBody: "ERROR",
            statusCode: "400",
          },
        },
      ],
    }
  );

  return {
    privateSubnetGroupName: privateSubnetGroup.name,
    vpcSecurityGroupIds: [
      dbClusterIngressSecurityGroup.id,
      egressAllSecurityGroup.id,
    ],
    ecsSecurityGroupIds: [
      egressAllSecurityGroup.id,
      ingressAllSecurityGroup.id,
    ],
    privateSubnetIds: [privateSubnetA.id, privateSubnetB.id],
    loadBalancerHttpsListenerArn: loadBalancerHttpsListener.arn,
    vpcId: vpc.id,
  };
};
