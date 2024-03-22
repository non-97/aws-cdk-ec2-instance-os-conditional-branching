import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemParams, NetworkParams } from "../../parameter/index";

export interface NetworkConstructProps extends SystemParams, NetworkParams {}

export class NetworkConstruct extends Construct {
  readonly vpc: cdk.aws_ec2.IVpc;

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    // VPC
    this.vpc = new cdk.aws_ec2.Vpc(this, "Default", {
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr(props.vpcCidr),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: props.natGateways,
      maxAzs: props.maxAzs,
      subnetConfiguration: props.subnetConfigurations,
      vpcName: `${props.systemPrefix}-${props.envName}-vpc`,
    });

    // Subnet and Route Table Tag
    props.subnetConfigurations.forEach((subnetConfiguration) => {
      this.vpc
        .selectSubnets({ subnetGroupName: subnetConfiguration.name })
        .subnets.forEach((subnet) => {
          const az = subnet.availabilityZone.slice(-2);

          cdk.Tags.of(subnet).add(
            "Name",
            `${props.systemPrefix}-${props.envName}-subnet-${subnetConfiguration.name}-${az}`
          );

          const routeTable = subnet.node.tryFindChild(
            "RouteTable"
          ) as cdk.aws_ec2.CfnRouteTable;

          cdk.Tags.of(routeTable).add(
            "Name",
            `${props.systemPrefix}-${props.envName}-rtb-${subnetConfiguration.name}-${az}` // CFn版だとpublicはルートテーブルが1つ
          );
        });
    });

    // IGW Tag
    const igw = this.vpc.node.tryFindChild("IGW");
    if (igw) {
      cdk.Tags.of(igw).add(
        "Name",
        `${props.systemPrefix}-${props.envName}-igw`
      );
    }

    // NAT Gateway and Elastic IP Tag
    if (props.natGateways === 0) {
      return;
    }
    this.vpc.publicSubnets.forEach((subnet) => {
      const az = subnet.availabilityZone.slice(-2);

      cdk.Tags.of(
        subnet.node.tryFindChild("NATGateway") as cdk.aws_ec2.CfnNatGateway
      ).add("Name", `${props.systemPrefix}-${props.envName}-natgw-${az}`);

      cdk.Tags.of(subnet.node.tryFindChild("EIP") as cdk.aws_ec2.CfnEIP).add(
        "Name",
        `${props.systemPrefix}-${props.envName}-eip-natgw-${az}`
      );
    });
  }
}
