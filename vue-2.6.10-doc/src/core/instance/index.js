import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
//@doc 实例上添加 Vue.prototype._init
initMixin(Vue) 
/*
* @doc
* 实例上添加 $data、$props
* 实例上添加 $set、$delete
* 实例上添加 $watch
*/
stateMixin(Vue)
/*
* @doc
* 实例上添加 $on $once $off $emit  存放在_events变量里
*/
eventsMixin(Vue)
/*
* @doc
* 实例上添加 _update、$forceUpdate、$destroy
*/
lifecycleMixin(Vue)
/*
* @doc
*  target._o = markOnce
*  target._n = toNumber
*  target._s = toString
*  target._l = renderList
*  target._t = renderSlot
*  target._q = looseEqual
*  target._i = looseIndexOf
*  target._m = renderStatic
*  target._f = resolveFilter
*  target._k = checkKeyCodes
*  target._b = bindObjectProps
*  target._v = createTextVNode
*  target._e = createEmptyVNode
*  target._u = resolveScopedSlots
*  target._g = bindObjectListeners
*  target._d = bindDynamicKeys
*  target._p = prependModifier
* 实例上添加$nextTick、_render
*/
renderMixin(Vue)

export default Vue
