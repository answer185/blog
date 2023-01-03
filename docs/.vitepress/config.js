import { defineConfig } from 'vitepress'
import nav from './config/nav'
import sidebar from './config/sidebar'

export default defineConfig({
  title: '七夜',
  description: '记录个人对技术的理解',
  lastUpdated: false,
  themeConfig: {
    repo: 'answer185/blog',
    docsDir: 'docs',
    docsBranch: 'main',
    editLinks: false,
    nav,
    sidebar
  }
})
