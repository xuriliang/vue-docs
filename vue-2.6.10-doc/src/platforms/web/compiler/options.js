/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,         //@doc [ klass,style,model]
  directives, //@doc 指令 {model,text,html}
  isPreTag,  //@doc tag === 'pre'
  isUnaryTag, //@doc 自闭和标签map
  mustUseProp, //@doc attributes that should be using props for binding
  canBeLeftOpenTag, //@doc 只写左侧的tag，浏览器会自动补全的标签
  isReservedTag, //@doc 保留的标签
  getTagNamespace, //@doc 获取命名空间
  staticKeys: genStaticKeys(modules) //@doc staticClass,staticStyle
}
