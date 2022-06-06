function getFrontendSidebar() {
  return [
    {
      text: '前端',
      children: [
        { text: '前端基础', link: '/frontend/basic'},
        { text: '前端架构', link: '/frontend/framework'},
        { text: 'React生态', link: '/frontend/react'},
        { text: 'Vue生态', link: '/frontend/vue'},
        { 
          text: '前端开发', 
          children: [
            { text: 'PWA总结', link: '/frontend/pwa'},
            { text: '组件库总结', link: '/frontend/componnet-library' },
            { text: '微前端总结', link: '/frontend/micro-frontend'}
          ]
        },
      ]
    }
  ]
}
function getBackendSidebar() {
  return [
    { 
      text: '后端',
      children: [
        {text: 'nodejs', link: '/backend/nodejs'},
        {text: 'php', link: '/backend/php'},
        {text: 'go', link: '/backend/go'},
        {text: 'java', link: '/backend/java'},
        {text: 'sql', link: '/backend/sql'},
      ]
    }
  ]
}

function getBasicSidebar() {
  return [
    {
      text: '编程基础',
      children: [
        {text: '数据结构', link: '/basic/data-structure'},
        {text: '算法', link: '/basic/algorithm'},
        {text: 'http', link: '/basic/http'}
      ]
    }
  ]
}
function getManagerSidebar() {
  return [
    {
      text: '管理',
      children: [
        { text: '管理', link: '/manager/basic' },
        { text: '项目管理', link: '/manager/project' },
        { text: '团队管理', link: '/manager/team' }
      ]
    }
  ]
}
function getMeSidebar() {
  return [
    {
      text: '关于我',
      children: [
        {text: '个人说明', link: '/me/about'},
        {text: '个人简历', link: '/me/resume'}
      ]
    }
  ]
}

export default {
  '/frontend/': getFrontendSidebar(),
  '/backend/': getBackendSidebar(),
  '/basic/': getBasicSidebar(),
  '/manager/': getManagerSidebar(),
  '/me/': getMeSidebar(),
  '/': []
}