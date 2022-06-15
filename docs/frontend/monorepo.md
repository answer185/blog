# Monorepo
## 什么是Monorepo
Monorepo是软件工程领域的概念，相对于传统的把各个项目独立一个仓库的MultiRepo模式，Monorepo是把多个项目放在一个仓库里管理。

![](/images/frontend/monorepo.png)

## MultiRepo的不足
### 代码复用
项目之间公共的代码逻辑经常是拷贝，当需要改动时，就需要拷贝多分

### 依赖的版本管理
项目之间相同的依赖，版本经常不同，可能存在某个升级，但是另一些没升级，导致出现奇怪的错误。

### 项目基建
需要单独配置开发环境、CI流程、配置部署发布流程等等。甚至每个项目都有自己单独的一套脚手架工具。而这些都是重复的工作。

## Monorepo的优势
- 工作流一致：改动发现问题更及时，不会出现不一致的情况
- 项目基建成本低：只要一套工具就行
- 团队协作也更加容易：能够更方便的共享、检索代码

## Monorepo的落地设计
多用于基础组件库或者工具库。

基于Monorepo的项目设计并不是简单地把所有的项目放在一起。还需要考虑:
1. 项目间依赖分析、依赖安装、构建流程、测试流程、CI 及发布流程等诸多工程环节
2. 项目达到一定层次后的性能问题。比如项目构建/测试时间过长需要进行增量构建/测试、按需执行 CI等等

## Monorepo开源解决方案
### 较底层的方案
- yarn:workspace+lerna: 封装了 Monorepo 中的依赖安装、脚本批量执行等等基本的功能，但没有一套构建、测试、部署的工具链，整体 Monorepo 功能比较弱，但要用到业务项目当中，往往需要基于它进行顶层能力的封装，提供全面工程能力的支撑。
- pnpm: 也是提供了依赖安装、脚本批量执行等基本功能。 效率要比yarn+lerna的方式更高效
### 集成方案
提供从初始化、开发、构建、测试到部署的全流程能力，有一套比较完整的 Monorepo 基础设施，适合直接拿来进行业务项目的开发。不过由于这些顶层方案内部各种流程和工具链都已经非常完善了，如果要基于这些方案来定制，适配和维护的成本过高，基本是不可行的。
- nx
- rushstack

## Monorepo的问题
### 多实例问题
#### 背景
多项目之间的依赖极其复杂，在演进过程中很难保证所有的依赖都是固定在某个版本。比如一个项目依赖 webpack4 ，另一个依赖 webpack5。经常容易产生依赖版本冲突，造成多层依赖上游链路混用 “隐形依赖” 的版本问题，最终导致项目跑不起来或者运行失败。

- Lerna: 不严格隔离，冲突时，统一使用主应用的版本。
- pnpm: 严格的依赖隔离管理。每个依赖严格的限制了自己只能使用符合自己版本的依赖。

比如某个子包使用antd的4.10版本，另一个使用了4.15版本。Lerna使用提升的方式，只获取一个版本的antd。pnpm刚会从 子包/node_modules中找起。这样就会存在各个子包使用不同实例的问题。

#### pnpm的解决方式
##### 方式一：alias直接指定
以webpack为例，给主应用的配置上加上相应的路径。
```js
  resolve: {
    alias: {
      'antd': path.resolve(__dirname, 'node_modules/antd'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      ...
    },
  },
```
##### 方式二：pnpm的hoist配置
在配置中指定提升的方案
```
# .npmrc

# 强制提升所有 antd 到全局，保证唯一实例
public-hoist-pattern[]=antd

# 不配置这个选项时候的默认值，我们要手动把他加上
public-hoist-pattern[]=*types*
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=@prettier/plugin-*
public-hoist-pattern[]=*prettier-plugin-*
```

## 使用pnpm搭建Monorepo项目
### 配置pnpm-workspace.yaml
在项目中创建，声明这是pnpm管理的Monorepo项目。

该配置文件主要声明项目中子包的路径。

如element-plus项目的配置如下：
```
packages:
  - packages/*
  - docs
  - play
  - internal/*
```
也可以使用!来做反向过滤

```
packages:
  # all packages in subdirs of packages/ and components/
  - 'packages/**'
  # exclude packages that are inside test directories
  - '!**/test/**'
```
### 管理依赖
理论上来说，只要挑选出各个项目的共同依赖，然后提到最外层的即可。但是实际开发时，经常出现共同依赖也需要分版本的情况。比如某个项目可能依赖react16。而最新的项目，我们希望依赖于react18。像这样的公共库就不适合提到最上层。另外像lodash,typescript这样的库，基本上不会有大影响的公共库，就需要提到最上层，避免每个项目去安装一次。
使用pnpm安装后，所有不在子项目的依赖，默认会有个软链接到外层的node_modules。
可以关闭该配置，但是最好不要

```
// .npmrc中配置，即可关闭软链接的功能
shared-workspace-lockfile=false
```
### 创建启动命令
首先需要给每个子包命令，在package.json中设置name

其次启动命令，有两种方式，可以使用-C 或 --filter参数来找到相应的子应用。
"scripts": {
    "dev:app1": "pnpm start --filter \"@mono/app1\"",
    "dev:app2": "pnpm start --filter \"@mono/app2\"",
    "docs:dev": "pnpm run -C docs dev"
},

-C: 进入到某个指定的目录，并运行命令。

--filter: 根据workspace下的包名来启动。

### 跨包的热更新
设置共享包的main路径
比如在app2中需要暴露某些公共代码给其他应用，其入口文件为common/share/index.ts。
刚main的配置如下：
```
{
  "main": "./src/common/share/index.ts"
}
```
### 设置workspace的包依赖
pnpm的workspace依赖的语法如下：
```
{
  "dependencies": {
    "@mono/app2": "workspace:*"
  }
}
```
可以在要引用 app2 的包中设置，也可以在最外层的主应用中设置。

@mono/app2 为共享包的名称。

### 在其他应用中导入
导入方式与导入库的方式一样，名称为相应的包名称：
```
import { Button } from '@mono/app2'
```
### 编译
#### 背景
在构建时，可能会出现以下3种情况：
1. 通常项目的寻址路径只针对本项目寻找，对其他目录的文件，会出现加载不到的情况。
2. 子包名称更换：@mono/app2 之类的包名可能也会换成某个特定的名称。如，@element-plus/components 会换成element-plus/components。
3. 引入的文件有当前项目不支持的特性：如包中使用ts,但是引用的项目没有ts的解析配置
#### 解决
1. 补全相应的文件处理配置。
2. 首先要书写匹配相关子包文件路径的方法。
3. 在合适的位置添加相应的文件，如：
  1. webpack：在检测到相应的loader中，添加路径。
  2. gulp：在寻址时，加上其他包的文件路径。
  3. Rollup： 添加子包的入口路径。

## lerna+yarn
https://github.com/Quramy/lerna-yarn-workspaces-example

1. 使用yarn代替lerna的包管理。
  1. yarn add
  2. yarn workspace
2. lerna.json中配置npmClient为yarn及useWorkspaces为true。该配置会在node_modules上生成一个到子包的链接，将开发中的包变成一个依赖。
```
{
  "lerna": "2.2.0",
  "packages": [
    "packages/*"
  ],
  "npmClient": "yarn",
  "useWorkspaces": true,
  "version": "1.0.0"
}
```
3. 在package.json中声明workspace
```
{
  "private": true, // 工作空间不需要发布
  ...
  "workspaces": ["packages/*"]
}
```

4. 在tsconfig.json中添加path路径
```
/* tsconfig.json */
{
  "compilerOptions": {
    /* other options */
    "baseUrl": "./packages",
    "paths": {
      "@quramy/*": ["./*/src"]
    }
  }
}
```