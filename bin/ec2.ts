#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Ec2Stack } from "../lib/ec2-stack";
import { ec2StackParams } from "../parameter/index";

const app = new cdk.App();
new Ec2Stack(
  app,
  `cicd-${ec2StackParams.props.systemParams.systemPrefix}-${ec2StackParams.props.systemParams.envName}`,
  {
    env: ec2StackParams.env,
    ...ec2StackParams.props,
  }
);
