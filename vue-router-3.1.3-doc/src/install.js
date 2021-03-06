import View from './components/view'
import Link from './components/link'

export let _Vue

export function install (Vue) {
  if (install.installed && _Vue === Vue) return
  install.installed = true

  _Vue = Vue

  const isDef = v => v !== undefined

  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  Vue.mixin({
    beforeCreate () {
      if (isDef(this.$options.router)) { //@doc Vue参数中VueRouter实例
        this._routerRoot = this
        this._router = this.$options.router
        this._router.init(this) 
        Vue.util.defineReactive(this, '_route', this._router.history.current) //@doc 定义_route当前路由
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })
  //@doc this.$router 指向 this._routerRoot._router
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })
  //@doc this.$route 指向 this._routerRoot._route
  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  Vue.component('RouterView', View) //@doc <router-view></router-view>
  Vue.component('RouterLink', Link) //@doc <router-link></router-link>

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  //@doc 路由钩子
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
