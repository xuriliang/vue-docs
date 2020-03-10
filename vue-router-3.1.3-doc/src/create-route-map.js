/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

export function createRouteMap (
  routes: Array<RouteConfig>,  //@doc 路由配置
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>, //@doc path数组
  pathMap: Dictionary<RouteRecord>,//@doc {path : RouteRecord}
  nameMap: Dictionary<RouteRecord> //@doc {name : RouteRecord}
} {
  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  routes.forEach(route => { //@doc 遍历路由配置
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) { //@doc 确保通配符 * 在数组最后
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    const found = pathList
    // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

/*
* @doc 
* 循环路由配置，解析返回pathList、pathMap、nameMap对象
* pathList: 路由的路径，子路的路径会把父路由的拼接上去
* pathMap: {path: Record}
* nameMap: {name: Record}
*/
function addRouteRecord (
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig, //@doc 当前的路由配置
  parent?: RouteRecord,
  matchAs?: string //@doc 别名路径
) {
  const { path, name } = route  //@doc 取出path和name属性
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    )
  }

  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {} //@doc 编译正则的选项
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict) //@doc 如果有父路由，路径前面拼接父路由的地址

  if (typeof route.caseSensitive === 'boolean') { //@doc 匹配规则是否大小写敏感
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  const record: RouteRecord = {
    path: normalizedPath, //@doc 路由path，如果有父路由，路径前面拼接父路由的地址
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions), //@doc url正则表达式
    components: route.components || { default: route.component },
    instances: {},
    name, //@doc 命名路由
    parent, 
    matchAs,
    redirect: route.redirect, //@doc 跳转地址
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props:
      route.props == null
        ? {}
        : route.components
          ? route.props
          : { default: route.props }
  }

  if (route.children) { //@doc如果存在子路由，递归辖区
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      if (
        route.name &&
        !route.redirect &&
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${
              route.name
            }'"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`
        )
      }
    }
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path)  //@doc 存储解析后的路由路径
    pathMap[record.path] = record //@doc key为路由路径 ，value为解析的路由对象
  }

  if (route.alias !== undefined) { //@doc 别名，多个路径都指向同一个组件
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i]
      if (process.env.NODE_ENV !== 'production' && alias === path) {
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        )
        // skip in dev to make it work
        continue
      }
      //@doc 如果存在别名，别名也作为一个path
      const aliasRoute = {
        path: alias,
        children: route.children
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs  @doc别名对应的真实路径
      )
    }
  }

  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record  //@doc key为路由名称 ，value为解析的路由对象
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex (
  path: string, //@doc 处理后的路由path
  pathToRegexpOptions: PathToRegexpOptions //@doc 正则选项
): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions)  //@doc npm path-to-regexp
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}
//@doc 路由路径处理，如果parent存在，拼接parent的path
function normalizePath (
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  if (!strict) path = path.replace(/\/$/, '') //@doc 去掉最后一个/
  if (path[0] === '/') return path
  if (parent == null) return path
  return cleanPath(`${parent.path}/${path}`)  //doc 替换// -> /
}
