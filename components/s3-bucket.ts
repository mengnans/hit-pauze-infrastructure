import { TerraformOutput } from "cdktf";
import {
  S3Bucket,
  S3BucketCorsConfiguration,
  S3BucketPolicy,
} from "@cdktf/provider-aws/lib/s3";
import {
  CloudfrontCachePolicy,
  CloudfrontDistribution,
} from "@cdktf/provider-aws/lib/cloudfront";
import { Route53Record } from "@cdktf/provider-aws/lib/route53";

interface IS3BucketStackProps {
  bucketName: string;
  enableCors: boolean;
  alternativeDomainName?: string;
  hostedZoneId?: string;
  acmCertificateArn?: string;
  tags: { [key: string]: string };
}

export const setupS3Bucket = (self: any, props: IS3BucketStackProps) => {
  // PUBLIC ACCESSIBLE S3 BUCKET
  const bucket = new S3Bucket(self, props.bucketName, {
    bucket: props.bucketName,
    tags: props.tags,
  });

  new S3BucketPolicy(self, `${props.bucketName}-bucket-policy`, {
    bucket: bucket.id,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            AWS: "*",
          },
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${props.bucketName}/*`,
        },
      ],
    }),
  });

  if (props.enableCors) {
    new S3BucketCorsConfiguration(
      self,
      `${props.bucketName}-cors-configuration`,
      {
        bucket: bucket.id,
        corsRule: [
          {
            allowedHeaders: ["*"],
            allowedMethods: ["GET", "PUT"],
            allowedOrigins: ["*"],
            exposeHeaders: ["ETag"],
            maxAgeSeconds: 3000,
          },
        ],
      }
    );
  }

  const cloudfrontCachePolicy = new CloudfrontCachePolicy(
    self,
    `${props.bucketName}-cache-policy`,
    {
      name: `${props.bucketName}-cache-policy`,
      minTtl: 1,
      maxTtl: 31536000,
      defaultTtl: 86400,
      parametersInCacheKeyAndForwardedToOrigin: {
        headersConfig: {
          headerBehavior: "none",
        },
        cookiesConfig: {
          cookieBehavior: "none",
        },
        queryStringsConfig: {
          queryStringBehavior: "none",
        },
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true,
      },
    }
  );

  const cloudfront = new CloudfrontDistribution(
    self,
    `${props.bucketName}-cloud-front-distribution`,
    {
      origin: [
        {
          domainName: bucket.bucketRegionalDomainName,
          originId: bucket.id,
        },
      ],
      enabled: true,
      isIpv6Enabled: true,
      defaultRootObject: "index.html",
      defaultCacheBehavior: {
        compress: true,
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        targetOriginId: bucket.id,
        viewerProtocolPolicy: "allow-all",
        cachePolicyId: cloudfrontCachePolicy.id,
      },
      customErrorResponse: [
        {
          errorCode: 404,
          errorCachingMinTtl: 10,
          responseCode: 200,
          responsePagePath: "/index.html",
        },
        {
          errorCode: 403,
          errorCachingMinTtl: 300,
          responseCode: 200,
          responsePagePath: "/index.html",
        },
      ],
      viewerCertificate: {
        cloudfrontDefaultCertificate: !!props.alternativeDomainName
          ? false
          : true,
        acmCertificateArn: !!props.alternativeDomainName
          ? props.acmCertificateArn
          : undefined,
        sslSupportMethod: !!props.alternativeDomainName
          ? "sni-only"
          : undefined,
      },
      restrictions: {
        geoRestriction: {
          restrictionType: "none",
        },
      },
      aliases: props.alternativeDomainName ? [props.alternativeDomainName] : [],
      tags: props.tags,
    }
  );

  if (!!props.alternativeDomainName && !!props.hostedZoneId) {
    new Route53Record(self, `${props.bucketName}-route53-record`, {
      zoneId: props.hostedZoneId,
      name: props.alternativeDomainName,
      type: "A",
      alias: [
        {
          name: cloudfront.domainName,
          zoneId: cloudfront.hostedZoneId,
          evaluateTargetHealth: false,
        },
      ],
    });
  }

  new TerraformOutput(self, `${props.bucketName}-bucket-id`, {
    value: bucket.id,
  });

  new TerraformOutput(self, `${props.bucketName}-cloudfront-id`, {
    value: cloudfront.id,
  });
};
