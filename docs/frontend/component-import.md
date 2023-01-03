# 组件库加载
## 加载方式
1. unpkg导入：通过script标签加载整个库的js，需要放在head中
```
<head>
  <!-- 导入样式 -->
  <link rel="stylesheet" href="//unpkg.com/element-plus/dist/index.css" />
  <!-- 导入 Vue 3 -->
  <script src="//unpkg.com/vue@next"></script>
  <!-- 导入组件库 -->
  <script src="//unpkg.com/element-plus"></script>
</head>
```
不足：多一次http请求，整个库必须完整引入

2. 完整导入：使用import的方式，在应用的入口文件处加载整个依赖，并注册
```
// main.ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus)
app.mount('#app')
```
优点：在开发时，不需要再导入相关的组件。

不足：打包时，整个element-plus会全部打进去。

3. 按需加载：

根据组件或API的前缀等规则，在运行及构建时自动解析依赖。

优点：可以像完整导入一样，在任意位置使用组件或API，构建时，根据实际的使用情况打包。

缺点：配置及调查问题复杂
```
<template>
  <el-row class="mb-4">
    <el-button disabled>Default</el-button>
    <el-button type="primary" disabled>Primary</el-button>
    <el-button type="success" disabled>Success</el-button>
    <el-button type="info" disabled>Info</el-button>
    <el-button type="warning" disabled>Warning</el-button>
    <el-button type="danger" disabled>Danger</el-button>
  </el-row>

  <el-row>
    <el-button plain disabled>Plain</el-button>
    <el-button type="primary" plain disabled>Primary</el-button>
    <el-button type="success" plain disabled>Success</el-button>
    <el-button type="info" plain disabled>Info</el-button>
    <el-button type="warning" plain disabled>Warning</el-button>
    <el-button type="danger" plain disabled>Danger</el-button>
  </el-row>
</template>
```
4. 手动加载：

在开发时，手动加载相关的依赖。构建时，根据组件的依赖关系打包。

优点：根据实际使用情况打包，而不是完整的构建

不足：每个组件时候时，需要去写相关的导入代码。

```
<template>
  <el-button>I am ElButton</el-button>
</template>
<script>
  import { ElButton } from 'element-plus'
  export default {
    components: { ElButton },
  }
</script>
```

## 实现原理
### 按需加载
#### element-plus的实现原理
element-plus的实现是基于 unplugin-auto-import 及 unplugin-vue-components 实现。

在识别到组件代码中有未导入的依赖时，会触发执行。

如果当前的依赖名称以El开头，则会在代码中增加相关依赖的导入代码。如ElButton，会添加：
```
import { ElButton as __unplugin_components_0 } from '/node_modules/.vite/deps/element-plus_es.js?v=51ca5312';
import '/node_modules/.vite/deps/element-plus_es_components_button_style_css.js?v=51ca5312';
```
加载了相关组件及css的代码。

调试: 可以在chrome的source下，找到相应的vue文件查看。
#### unplugin-auto-import及unplugin-vue-components
##### 原理
这两个库是按需加载的解决方案之一，import库针对的是API, components库针对的是组件。

内置支持了主流的构建工具及优秀的组件库。如果只是简单使用的话，基本上不需要再开发。

实现的原理就是拦截模块的解析，根据resolver函数的返回信息为应用补全相应的依赖。补全的方式有4种：
```
export function stringifyImport(info: ImportInfo | string) {
  if (typeof info === 'string')
    return `import '${info}'`
  if (!info.as)
    return `import '${info.from}'`
  else if (info.name)
    return `import { ${info.name} as ${info.as} } from '${info.from}'`
  else
    return `import ${info.as} from '${info.from}'`
}
```
没有 import { ElButton } from 'element-plus' 的方式，所以传入name时，一定也要有as属性。

##### 扩展
两个组件都支持对resolvers进行扩展，一般只要书写一个简单的函数，并返回依赖的相关信息。函数可以接收到依赖的名称。如下：

```
Components({
  resolvers: [
    // example of importing Vant
    (componentName) => {
      // where `componentName` is always CapitalCase
      if (componentName.startsWith('Van'))
        return { name: componentName.slice(3), from: 'vant' }
    },
  ],})
```

也可以直接返回一个数组：

```
export function ElementPlusResolver(
  options: ElementPlusResolverOptions = {},
): ComponentResolver[] {
  let optionsResolved: ElementPlusResolverOptionsResolved

  async function resolveOptions() {
    if (optionsResolved)
      return optionsResolved
    optionsResolved = {
      ssr: false,
      version: await getPkgVersion('element-plus', '2.2.2'),
      importStyle: 'css',
      directives: true,
      exclude: undefined,
      ...options,
    }
    return optionsResolved
  }

  return [
    {
      type: 'component',
      resolve: async (name: string) => {
        return resolveComponent(name, await resolveOptions())
      },
    },
    {
      type: 'directive',
      resolve: async (name: string) => {
        return resolveDirective(name, await resolveOptions())
      },
    },
  ]
}
```

##### sideEffects
该属性的使用场景是：依赖需要再加载其他文件后，包才可以执行时使用。即一个依赖名称需要生成多个。element-plus自身即为这种场景，组件库还依赖于相应的css:

```
function getSideEffects(dirName: string): SideEffectsInfo {
  const themeFolder = 'homeking-ui/theme-chalk'
  const esComponentsFolder = 'homeking-ui/es/components'
  let ssr = false
  return ssr ? `${themeFolder}/el-${dirName}.css` : `${esComponentsFolder}/${dirName}/style/css`
}
function HomekingUIResolver(name) {
  if (!name.match(/^Hk[A-Z]/)) {
    return
  }
  const partialName = kebabCase(name.slice(2))// HkTableColumn -> table-column
   return {
    name,
    from: 'homeking-ui/es',
    sideEffects: getSideEffects(partialName),
  }
}
```

##### 依赖的库也是按需加载
如：当自定义的组件库依赖与element-plus的某个组件时，element-plus的组件并不会自动加载。

这是因为相应的import代码是根据resolver来生成， unplugin-vue-components库只处理该返回值，不会处理更深层级库的情况。

需要通过维护组件与element-plus组件的关系，通过sideEffects补全。 再结合手动加载的配置，才可以保证两个库都自动按需加载。

### 手动加载
element-plus是通过 [unplugin-element-plus](https://www.npmjs.com/package/unplugin-element-plus) 实现。
原理是：
1. 根据配置将element-plus指向lib或es目录。
2. 根据import的组件名称，自动添加组件 css的导入代码

