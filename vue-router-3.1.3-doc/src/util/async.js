/* @flow */

//@doc 同步执行队列
export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    if (index >= queue.length) { 
      cb() 
    } else {
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1)  //@doc 在回调里执行队列的下一个元素，确保是同步执行
        })
      } else {
        step(index + 1)
      }
    }
  }
  step(0)
}
