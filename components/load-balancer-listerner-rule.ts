// eslint-disable @typescript-eslint/no-unused-vars
import { LbListenerRule, LbTargetGroup } from "@cdktf/provider-aws/lib/elb";

interface ISupertokensLBListenerProps {
  vpcId: string;
  loadBalancerHttpsListenerArn: string;
  tags: { [key: string]: string };
  environment: string;
  projectName: string;
}

export interface ISupertokensLBListenerOutput {
  adminSupertokensTargetGroup: LbTargetGroup;
  supertokensTargetGroup: LbTargetGroup;
}

export const setupSupertokensLBListener = (
  self: any,
  props: ISupertokensLBListenerProps
): ISupertokensLBListenerOutput => {
  // admin supertokens target group
  const adminSupertokensTargetGroup = new LbTargetGroup(
    self,
    `${props.environment}-admin-supertokens-target-group`,
    {
      name: `${props.projectName}-${props.environment}-admin-supertokens`,
      port: 3567,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: props.vpcId,
      tags: props.tags,
      healthCheck: {
        enabled: true,
        path: "/hello",
        port: "3567",
        timeout: 120,
        interval: 180,
      },
    }
  );

  // admin supertokens listener
  const adminSuperTokenUrls =
    props.environment + "-admin-supertokens." + self._domainName;

  new LbListenerRule(
    self,
    `${props.environment}-load-balancer-admin-supertokens-listener-rule`,
    {
      listenerArn: props.loadBalancerHttpsListenerArn,
      tags: props.tags,
      action: [
        {
          type: "forward",
          targetGroupArn: adminSupertokensTargetGroup.arn,
        },
      ],
      condition: [
        {
          hostHeader: { values: [adminSuperTokenUrls] },
        },
      ],
    }
  );

  // supertokens target group
  const supertokensTargetGroup = new LbTargetGroup(
    self,
    `${props.environment}-supertokens-target-group`,
    {
      name: `${props.projectName}-${props.environment}-supertokens`,
      port: 3568,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: props.vpcId,
      tags: props.tags,
      healthCheck: {
        enabled: true,
        path: "/hello",
        port: "3568",
        timeout: 120,
        interval: 180,
      },
    }
  );

  // supertokens listener
  const superTokenUrls =
    props.environment + "-app-supertokens." + self._domainName;

  new LbListenerRule(
    self,
    `${props.environment}-load-balancer-supertokens-listener-rule`,
    {
      listenerArn: props.loadBalancerHttpsListenerArn,
      tags: props.tags,
      action: [
        {
          type: "forward",
          targetGroupArn: supertokensTargetGroup.arn,
        },
      ],
      condition: [
        {
          hostHeader: { values: [superTokenUrls] },
        },
      ],
    }
  );
  return {
    adminSupertokensTargetGroup: adminSupertokensTargetGroup,
    supertokensTargetGroup: supertokensTargetGroup,
  };
};
