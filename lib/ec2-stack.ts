import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ec2Props } from "../parameter/index";
import { NetworkConstruct } from "./construct/network-construct";
import { Ec2Construct } from "./construct/ec2-construct";

export interface Ec2StackProps extends cdk.StackProps, ec2Props {}

export class Ec2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id, props);

    const networkConstruct = new NetworkConstruct(this, "NetworkConstruct", {
      ...props.systemParams,
      ...props.networkParams,
    });

    const ec2Construct = props.ec2Params
      ? new Ec2Construct(this, "Ec2Construct", {
          ...props.systemParams,
          ...props.ec2Params,
          networkConstruct,
        })
      : undefined;
  }
}
