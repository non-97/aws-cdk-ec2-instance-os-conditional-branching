import * as cdk from "aws-cdk-lib";

export interface NetworkParams {
  vpcCidr: string;
  subnetConfigurations: cdk.aws_ec2.SubnetConfiguration[];
  maxAzs: number;
  natGateways: number;
}

export interface Ec2Params {
  instances: {
    instanceName?: string;
    machineImage: cdk.aws_ec2.IMachineImage;
    instanceType: cdk.aws_ec2.InstanceType;
    blockDevices: cdk.aws_ec2.BlockDevice[];
    subnetSelection: cdk.aws_ec2.SubnetSelection;
  }[];
}

export interface SystemParams {
  systemPrefix: string;
  envName: string;
}

export interface ec2Props {
  systemParams: SystemParams;
  networkParams: NetworkParams;
  ec2Params?: Ec2Params;
}

export interface ec2StackParams {
  env?: cdk.Environment;
  props: ec2Props;
}

export const ec2StackParams: ec2StackParams = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  props: {
    systemParams: {
      systemPrefix: "non-97",
      envName: "sandbox",
    },
    networkParams: {
      vpcCidr: "10.10.0.0/20",
      subnetConfigurations: [
        {
          name: "public",
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          cidrMask: 27,
        },
      ],
      maxAzs: 2,
      natGateways: 0,
    },
    ec2Params: {
      instances: [
        {
          instanceName: "web",
          machineImage: cdk.aws_ec2.MachineImage.latestAmazonLinux2023({
            cachedInContext: true,
          }),
          instanceType: new cdk.aws_ec2.InstanceType("t3.micro"),
          blockDevices: [
            {
              deviceName: "/dev/xvda",
              volume: cdk.aws_ec2.BlockDeviceVolume.ebs(11, {
                volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
                encrypted: true,
              }),
            },
          ],
          subnetSelection: {
            subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          },
        },
        {
          instanceName: "ubuntu",
          machineImage: cdk.aws_ec2.MachineImage.lookup({
            name: "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*",
            owners: ["099720109477"],
          }),
          instanceType: new cdk.aws_ec2.InstanceType("t3.micro"),
          blockDevices: [
            {
              deviceName: "/dev/sda1",
              volume: cdk.aws_ec2.BlockDeviceVolume.ebs(10, {
                volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
              }),
            },
          ],
          subnetSelection: {
            subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          },
        },
        {
          instanceName: "windows",
          machineImage: cdk.aws_ec2.MachineImage.latestWindows(
            cdk.aws_ec2.WindowsVersion.WINDOWS_SERVER_2022_JAPANESE_FULL_BASE
          ),
          instanceType: new cdk.aws_ec2.InstanceType("t3.medium"),
          blockDevices: [
            {
              deviceName: "/dev/sda1",
              volume: cdk.aws_ec2.BlockDeviceVolume.ebs(30, {
                volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
              }),
            },
          ],
          subnetSelection: {
            subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          },
        },
        {
          instanceName: "al2",
          machineImage: cdk.aws_ec2.MachineImage.latestAmazonLinux2({
            cachedInContext: false,
          }),
          instanceType: new cdk.aws_ec2.InstanceType("t3.micro"),
          blockDevices: [
            {
              deviceName: "/dev/xvda",
              volume: cdk.aws_ec2.BlockDeviceVolume.ebs(10, {
                volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
                encrypted: true,
              }),
            },
          ],
          subnetSelection: {
            subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          },
        },
        {
          instanceName: "rhel",
          machineImage: cdk.aws_ec2.MachineImage.lookup({
            name: "RHEL-9.3.0_HVM-20240117-x86_64-49-Hourly2-GP3",
            owners: ["309956199498"],
          }),
          instanceType: new cdk.aws_ec2.InstanceType("t3.micro"),
          blockDevices: [
            {
              deviceName: "/dev/sda1",
              volume: cdk.aws_ec2.BlockDeviceVolume.ebs(12),
            },
          ],
          subnetSelection: {
            subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          },
        },
      ],
    },
  },
};
