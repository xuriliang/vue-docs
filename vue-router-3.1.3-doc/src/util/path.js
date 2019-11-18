/* @flow */
//@doc 如果为相对路径，转换为绝对路径
export function resolvePath (
  relative: string, //@doc 相对路径
  base: string, //@doc 根路径
  append?: boolean //@doc 是否为追加
): string {
  const firstChar = relative.charAt(0)
  if (firstChar === '/') { //@doc 以/开头，为绝对路径，不需要处理
    return relative
  }

  if (firstChar === '?' || firstChar === '#') { //@doc ? # 为参数或hash，直接拼接
    return base + relative
  }

  const stack = base.split('/')

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop() //@doc 如果不是追加，删除最后一个元素
  }

  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment === '..') { //@doc .. 上一级目录
      stack.pop()
    } else if (segment !== '.') { //@doc 非当前目录，添加子目录
      stack.push(segment)
    }
  }

  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('') //@doc 开头添加一个空元素，以便join的时候开头有/
  }

  return stack.join('/')
}

//@doc 把路径分为 路径、hash、query(url查询参数)三段字符串
export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''

  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex)
    path = path.slice(0, hashIndex)
  }

  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }

  return {
    path,
    query,
    hash
  }
}
//@doc 替换// -> /
export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}
