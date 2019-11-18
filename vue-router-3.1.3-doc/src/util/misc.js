export function extend (a, b) {  //@doc 扩展对象
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
