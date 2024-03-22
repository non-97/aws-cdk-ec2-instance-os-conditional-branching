import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemParams, Ec2Params } from "../../parameter/index";
import { NetworkConstruct } from "./network-construct";
import * as fs from "fs";
import * as path from "path";

export interface Ec2ConstructProps extends SystemParams, Ec2Params {
  networkConstruct: NetworkConstruct;
}

interface ImageContext {
  account: string;
  filters: {
    "image-type"?: string[];
    name?: string[];
    state?: string[];
    [key: string]: string[] | undefined;
  };
  owners: string[];
  region: string;
}

interface SupportOs {
  osName: string;
  machineImage: {
    namePattern: string;
    ownerId: string;
  };
}

const supportOses: SupportOs[] = [
  {
    osName: "al2",
    machineImage: {
      namePattern: "amzn2-ami.*",
      ownerId: "137112412989",
    },
  },
  {
    osName: "al2023",
    machineImage: {
      namePattern: "al2023-ami.*",
      ownerId: "137112412989",
    },
  },
  {
    osName: "windows",
    machineImage: {
      namePattern: "Windows_Server-.*",
      ownerId: "801119661308",
    },
  },
  {
    osName: "rhel",
    machineImage: {
      namePattern: "RHEL-.*",
      ownerId: "309956199498",
    },
  },
  {
    osName: "ubuntu",
    machineImage: {
      namePattern: ".*ubuntu-.*",
      ownerId: "099720109477",
    },
  },
];

export class Ec2Construct extends Construct {
  readonly instances: {
    instanceName: string;
    instance: cdk.aws_ec2.Instance;
  }[];

  constructor(scope: Construct, id: string, props: Ec2ConstructProps) {
    super(scope, id);

    // サポートOS判定
    const osNames = [
      ...new Set(
        props.instances
          .map((instanceProps) => {
            return this.isSupportedOs(instanceProps.machineImage);
          })
          .filter((osName): osName is string => !!osName)
      ),
    ];

    // サポート対象のOSだった場合はユーザーデータを組み立て
    const userDataOsNameMappings = osNames.map((osName) => {
      const userData =
        osName === "windows"
          ? cdk.aws_ec2.UserData.forWindows()
          : cdk.aws_ec2.UserData.forLinux();
      const userDataScript =
        osName === "windows"
          ? fs.readFileSync(
              path.join(__dirname, `../ec2-settings/user-data/windows.ps1`),
              "utf8"
            )
          : fs.readFileSync(
              path.join(__dirname, `../ec2-settings/user-data/${osName}.sh`),
              "utf8"
            );

      userData.addCommands(
        userDataScript
          .replace(/__SYSTEM_PREFIX__/g, props.systemPrefix)
          .replace(/__ENV_NAME__/g, props.envName)
      );
      return { osName, userData };
    });

    // IAM Role
    const role = new cdk.aws_iam.Role(this, "Role", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy"
        ),
      ],
      roleName: `${props.systemPrefix}-${props.envName}-role-ec2`,
    });
    const cfnInstanceProfile = new cdk.aws_iam.CfnInstanceProfile(
      this,
      "CfnInstanceProfile",
      {
        instanceProfileName: `${props.systemPrefix}-${props.envName}-instance-profile-ec2`,
        roles: [role.roleName],
      }
    );

    // EC2 Instances
    this.instances = props.instances.map((instanceProps) => {
      const instanceSuffix = instanceProps.instanceName
        ? `-${instanceProps.instanceName}`
        : "";
      const instanceName = `${props.systemPrefix}-${props.envName}-ec2${instanceSuffix}`;

      // Security Group
      const securityGroupName = `${props.systemPrefix}-${props.envName}-sg-ec2${instanceSuffix}`;
      const securityGroup = new cdk.aws_ec2.SecurityGroup(
        this,
        `SecurityGroup${instanceSuffix}`,
        {
          vpc: props.networkConstruct.vpc,
          securityGroupName,
          description: `Security Group for ${props.systemPrefix} ${props.envName} EC2 Instance ${instanceSuffix}`,
        }
      );
      cdk.Tags.of(securityGroup).add("Name", securityGroupName);

      // Instance
      const instance = new cdk.aws_ec2.Instance(
        this,
        `Instance${instanceSuffix}`,
        {
          machineImage: instanceProps.machineImage,
          instanceType: instanceProps.instanceType,
          vpc: props.networkConstruct.vpc,
          vpcSubnets: props.networkConstruct.vpc.selectSubnets(
            instanceProps.subnetSelection
          ),
          blockDevices: instanceProps.blockDevices,
          propagateTagsToVolumeOnCreation: true,
          role,
          requireImdsv2: true,
          userData: userDataOsNameMappings.find((userDataOsNameMapping) => {
            return (
              userDataOsNameMapping.osName ===
              this.isSupportedOs(instanceProps.machineImage)
            );
          })?.userData,
          securityGroup,
          instanceName: `${props.systemPrefix}-${props.envName}-ec2${instanceSuffix}`,
        }
      );

      // Instance profile
      instance.node.tryRemoveChild("InstanceProfile");
      const cfnInstance = instance.node.tryFindChild(
        "Resource"
      ) as cdk.aws_ec2.CfnInstance;
      cfnInstance.addDependency(cfnInstanceProfile);
      cfnInstance.addPropertyOverride(
        "IamInstanceProfile",
        cfnInstanceProfile.ref
      );

      return { instanceName, instance };
    });
  }

  // サポート対象のOSかどうか判定
  isSupportedOs = (machineImage: cdk.aws_ec2.IMachineImage) => {
    // AL 2023
    if (machineImage instanceof cdk.aws_ec2.AmazonLinux2023ImageSsmParameter) {
      return "al2023";
    }
    // AL 2
    else if (
      machineImage instanceof cdk.aws_ec2.AmazonLinux2ImageSsmParameter
    ) {
      return "al2";
    }
    // Windows
    else if (machineImage instanceof cdk.aws_ec2.WindowsImage) {
      return "windows";
    }
    // Lookup
    else if (machineImage instanceof cdk.aws_ec2.LookupMachineImage) {
      // Image IDの取得
      const imageId = machineImage.getImage(this).imageId;

      // 取得したImage IDが ami-1234 の場合はcontext.cdk.jsonに記録されていない場合
      // この場合は再度AMIの検索がかかる
      if (imageId === "ami-1234") {
        console.log("AMI not found in context.cdk.json");

        return undefined;
      }
      // ami-1234 以外でImage IDが指定されていた場合
      else if (imageId) {
        // cdk.context.jsonから対象のImage IDのキーを取得する
        const contextJson = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../../cdk.context.json"),
            "utf8"
          )
        );

        const imageContextKey = Object.keys(contextJson).find((key: string) => {
          return contextJson[key] === imageId;
        });

        if (!imageContextKey) {
          return;
        }

        // cdk.context.jsonのキーをパースする
        const imageContext = this.parseImageContext(imageContextKey);

        // パースしたcdk.context.jsonのキーとサポート対象のOSのオブジェクトの配列を突き合わせて、サポート対象かどうか判定する
        const supportOs = supportOses.find((supportOs) => {
          const imageNamePattern = new RegExp(
            supportOs.machineImage.namePattern
          );
          return (
            imageContext.filters.name &&
            imageContext.filters.name.filter((name) =>
              imageNamePattern.test(name)
            ).length > 0 &&
            imageContext.owners.filter(
              (owner) => owner === supportOs.machineImage.ownerId
            ).length > 0
          );
        });

        if (supportOs) {
          return supportOs.osName;
        } else {
          throw new Error("Unsupported machine image type");
        }
      } else {
        throw new Error("AMI not found");
      }
    }
    // 不明な型の場合はサポート対象外と判定する
    else {
      throw new Error("Unsupported machine image type");
    }
  };

  // cdk.context.jsonのImage keyのParse
  parseImageContext(imageContextKey: string): ImageContext {
    // imageContextKey は以下のようなフォーマット
    // "ami:account=123456789012:filters.image-type.0=machine:filters.name.0=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*:filters.state.0=available:owners.0=099720109477:region=us-east-1": "ami-0e21465cede02fd1e"
    const imageContext: ImageContext = {
      account: "",
      filters: {},
      owners: [],
      region: "",
    };

    const keyValueStrings = imageContextKey.split(":");
    const prefix = keyValueStrings.shift();

    if (prefix !== "ami") {
      throw new Error("Invalid image context key format");
    }

    // "=" をデリミタとしてパース
    for (const keyValueString of keyValueStrings) {
      const [key, value] = keyValueString.split("=");
      const parsedKey = key.replace(/\./g, "_");

      if (parsedKey === "account") {
        imageContext.account = value;
      } else if (parsedKey.startsWith("filters_")) {
        const [_, filterName] = parsedKey.split("_");
        if (!imageContext.filters[filterName]) {
          imageContext.filters[filterName] = [];
        }
        imageContext.filters[filterName]!.push(value);
      } else if (parsedKey.startsWith("owners_")) {
        imageContext.owners = value.split(",");
      } else if (parsedKey === "region") {
        imageContext.region = value;
      }
    }

    return imageContext;
  }
}
