# Element-plus的构建原理
[[toc]]
## 输入和输出
### 输入
packages/下的各个包：
- 都包含有入口文件。
- 必要的处理命令，方便外部调用。
- 组件的Js与css分离。

### 输出
| 类型 | 文件 | 类型说明 | 输出说明 |
|:-----|:-----|:-----------|:-----------|
|unpkg(浏览器直接引入) | dist/index.full.js | 可以通过CDN链接的方式加载,引入后，可以在html中直接使用el-button类的标签 | 输出一个立即执行函数 |
||dist/index.full.min.js |带代码压缩 | |
||dist/index.full.mjs| es6模块 ||
||dist/index.full.min.mjs| 带压缩的es6模块||
||dist/index.css| 合并及压缩后的所有css||
||*.map|相关的sourcemap文件||
|lib| lib/index.js| CommandJS类型的模块，使用require及module.exports来管理模块 ||
|module| es/index.mjs| ES6的模块，使用import及export来管理模块||
|theme-chalk| src/*| scss的源码|可以在项目中引入scss，与项目一起编译|
||el-*.css|每个组件的css|转译并压缩好的css文件|
||index.css| 所有css的合并|同dist/index.css|
|package.json等文件| package.json<br/> README.md<br/>global.d.ts|包的说明文件||
|types| types/**/*.d.ts| 组件及.ts文件的typescript类型| 在最后一步时，会拷贝到lib及es中，所以发版的时候，不需要再带上|

## 构建流程
### 流程框架
- pnpm run build: 触发构建命令
- pnpm run start -C internal/build: 执行internal/build下的start命令
- gulp --require sucrase/register/ts -f gulpfile.ts: 加载ts解析模块，触发gulpfile的默认导出函数的执行
- 使用series api来序列化相关操作
  - 清理：执行npm run clean 清除上次的操作。
    - pnpm run clean:dist && pnpm run clean --filter ./packages/ --stream
      - rimraf dist
  - createOutput: 初始化输出目录
  - 并行执行不同类型的构建操作
    - buildModules： 模块构建，输出lib和es
    - buildFullBundle: 构建unpkg包
    - generateTypesDefinitions： 生成type
    - buildHelper: 生成 IDE 支持，web-types.json，支持webstorm, vetur： attributes.json及tags.json
  - buildThemeChalk： 打包css，并复制到theme-chalk目录
  - copyTypesDefinitions：复制类型定义到types

### 清理的原理
pnpm run clean --filter ./packages/ --stream

filter表示指定packages目录下的所有子包。--stream表示从packages再输出一个流，读取不同的文件流，并行操作
效果是执行所有子包的clean命令。

目前只有 theme-chalk包有clean操作

### runTask原理
作用是把相应的任务名称与gulp的配置文件关联，执行相应的gulp函数，如：

- runTask('buildModules'),
- 使用withTaskName 设置相应的任务名称: 实际原理是为函数添加displayName的属性
- 新开一个进行，执行：pnpm run start buildModules命令
- 对应的原始命令是：gulp --require sucrase/register/ts -f gulpfile.ts buildModules
- buildModules为gulpfile导出的一个函数，对应src/tasks/modules.ts
- 执行该buildModules函数

### buildModules的原理
#### 执行过程
1. 读取出 packages 目录下的所有文件路径，并过滤掉node_modules、test、mock、gulpfile、dist等目录
2. 将input传入rollup，没有配置output，返回bundle
3. 根据bundle配置，写入文件

#### 文件路径
1. 使用fast-glob遍历，只读取文件，过滤掉目录。
2. 返回的路径是绝对路径。且只读取一级目录下的文件，如：某个组件，只读取index.ts
3. 过滤掉路径中有不支持的文件名称
4. 像constants这样没有src，文件都在外层，会重复处理。
5. 没有theme-chalk下的css相关文件。

#### rollup的应用
- input：只针对js
- plugins：
  - Element-plus-alias-plugin: 自定义的plugin，将组件里的 element-plus/theme-chalk/el-*** 转化为element-plus/theme-chalk/el-***。和包的导出方式保持一致
  - DefineOptions: 解析单文件组件里的defineOptions函数
  - vue及vuejsx: 解析vue的单文件组件，支持jsx语法
  - nodeResolve：打包第三方依赖
  - Commonjs: 支持commonjs模块
  - esbuild: 将ts及新的es语法，转化成相应的代码，并压缩。当前是转为到es2018
- external: 
  - 封装成函数，从pkg中读取同级的依赖过滤。
  - 根据element-plus/package.json下的peerdependencies来过滤掉不需要的依赖
- treeshake：过滤掉不需要的代码，现在是关闭的。

#### 输出文件
使用rollup返回的bundle对象的write API 及两种类型的配置输出内容到文件中。有两种格式：esm和cjs:

```js
[
  {
    format: 'esm',
    dir: '/Users/dc/httpdocs/homeking/fe-element-plus/dist/element-plus/es',
    exports: undefined,
    preserveModules: true,
    preserveModulesRoot: '/Users/dc/httpdocs/homeking/fe-element-plus/packages/element-plus',
    sourcemap: true,
    entryFileNames: '[name].mjs'
  },
  {
    format: 'cjs',
    dir: '/Users/dc/httpdocs/homeking/fe-element-plus/dist/element-plus/lib',
    exports: 'named',
    preserveModules: true,
    preserveModulesRoot: '/Users/dc/httpdocs/homeking/fe-element-plus/packages/element-plus',
    sourcemap: true,
    entryFileNames: '[name].js'
  }
]
```

输出函数: 输出操作是异步的，如果不设置Promise.all，并等待执行完，整个进程会提前结束

```js
export function writeBundles(bundle: RollupBuild, options: OutputOptions[]) {
  return Promise.all(options.map((option) => bundle.write(option)))
}
```
### buildFullBundle的原理
#### 执行过程
1. 创建 buildFullMinified 及 buildFull的任务，都调用buildFull，传入不同的minify设置
2. 触发buildFullEntry及buildFullLocaler的执行，localer生成多语言包，已经删除
3. buildFullEntry
  1. 根据 element-plus/index.ts的入口文件寻找依赖打包
  2. 输出umd及esm的两种full包，输出配置如下：

```js
[
    {
      format: 'umd',
      file: path.resolve(
        epOutput,
        'dist',
        formatBundleFilename('index.full', minify, 'js')
      ),
      exports: 'named',
      name: 'HomekingUI',
      globals: {
        vue: 'Vue',
      },
      sourcemap: minify,
    },
    {
      format: 'esm',
      file: path.resolve(
        epOutput,
        'dist',
        formatBundleFilename('index.full', minify, 'mjs')
      ),
      sourcemap: minify,
    },
  ]
```
#### esbuild的配置差异
- minify： 是否压缩代码的控制 ，buildModules不压缩，buildFullBundle在生成.min时压缩
- sourceMap的控制：buildModules默认是true,buildFullBundle在没有压缩时，不生成
- `production`的设置：buildModules没有，buildFullBundle才有

#### 输出文件
index.full系列的5个文件
Sourcemap: 只在压缩的情况下才生成
  
### generateTypesDefinitions的原理
- 遍历packages下.js， .ts及vue文件
- 借助 ts-morph，生成所有的.ts文件类型（除主库外的文件）
- 输入文件到dist/types下

### buildHelper的原理
- 根据 components-helper 生成 对webstorm及vscode的插件配置支持
- 有attributes.json、tags.json及web-types.json

### buildThemeChalk原理
- 执行packages包下的所有build命令：pnpm run --filter ./packages/ build --parallel
- 触发theme-chalk下的build命令执行
- 触发 buildThemeChalk
  - 使用gulp的src及dest api复制theme-chalk下的src到dist/theme-chalk/src下
  - 使用src读取所有的scss文件
  - 使用gulp-sass 处理scss
  - 使用gulp-autoprefixer添加完善css
  - 使用gulp-clean-css压缩css,并显示大小变化信息
  - 使用gulp-rename重命名文件，添加el-前缀
  - 输出到theme-chalk的dist下
- 触发 copyThemeChalkBundle， 复制them-chalk下的dist目录下的内容到外围的dist/element-plus/theme-chalk目录下
- 复制index.css到dist/element-plus/dist下，与index.full***组成完整的库

### copyTypesDefinitions原理
- 复制types下的.d.ts到es及lib中
- 使用fs-extra的copy API

### copyFiles的原理
- 复制element-plus下的package.json
- 复制项目的README.md及global.d.ts

## 多进程方案
最多时会分7个进程
- buildModules
- buildFullBundle
  - 压缩版本
  - 非压缩版本
- generateTypesDefinitions
- buildHelper
- buildThemeChalk

最后的文件复制也是分两个进程处理：
- 复制type，依赖于buildModules及generateTypesDefinitions任务的完成
- 复制说明包的说明文件