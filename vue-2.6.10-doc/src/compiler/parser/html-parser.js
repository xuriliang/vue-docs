/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
/*
* @doc
* \s*   匹配空格零次或多次
* ([^\s"'<>\/=]+)  匹配非(空格、双引号、单引号、/、<、>、=)一次或多次
* ?:  非捕获型括号，在match函数中不会有子表达式返回值
* \s*(=)\s*  匹配等号，左右可以包含零次或多次空格
* "([^"]*)"  匹配""及其包含的非"字符
* '([^']*)'  匹配''及其包含的非'字符
* ([^\s"'=<>`]+)  匹配非（空格、双引号、单引号、<、>、=、`）一次或多次
* 对应的子表达式有：([^\s"'<>\/=]+) 、 (=) 、 ([^"]*) 、 ([^']*) 、 ([^\s"'=<>`]+) ,也就是match函数返回数组中第1-5(第0个为匹配字符串)位置位对应的匹配值
* 如：'id = "app"'.match(/^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/),最后的?为0次或1次，有些属性可以缺省对应的值，如disabled
* 返回值如下:
*  0: "id = "app""
*  1: "id"
*  2: "="
*  3: "app"
*  4: undefined
*  5: undefined
*  groups: undefined
*  index: 0
*  input: "id = "app""
*/
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
/*
* @doc
* \s*   匹配空格零次或多次
* \w    等价于 [A-Za-z0-9_]
* (?:v-[\w-]+:|@|:|#)  匹配如：v-else-if v-bind:value="123" :key="123" @click="search"   # 暂时没想到使用场景？
* \[[^=]+\][^\s"'<>\/=]*  匹配[name]key格式,从2.6.0开始，可以用方括号括起来的JavaScript表达式作为一个指令的参数<a v-bind:[attributeName]="url"></a>
* (?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))同attribute
*/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
/*
* @doc
* \\-\\.  把-和.当成字符串处理
*/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
/*
* @doc
* 匹配标签开始，如：<div 、<svg:svg
*/
const startTagOpen = new RegExp(`^<${qnameCapture}`)
/*
* @doc
* 匹配标签关闭，如：/> 、>
*/
const startTagClose = /^\s*(\/?)>/
/*
* @doc
* 匹配结束标签,如</div>
*/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/
/*
* @doc
* 匹配条件注释，如:<!--[if !IE]> ... <![endif]-->
*/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
/*
* @doc 
* 纯文本标签
*/
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
/*
* @doc
* pre、textarea忽略换行标签
* makeMap => {pre: true,textarea: true},第二参数为可以是否转换成小写
*/
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}
/*
* @doc
* html推进处理，调用../parser/index.js中的start、end、chars、comment构造AST
*/
export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        const startTagMatch = parseStartTag() //@doc 解析开始标签，获取所有属性
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) { //@doc textEnd > 0代表标签前存在未处理的文本
        rest = html.slice(textEnd)
        /*
        * @doc
        * 如果只是纯字符 < 
        */
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1) //@doc indexOf(searchvalue,fromindex) 从指定位置开始搜索
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd) //@doc 处理下一个标签前的文本
      }

      if (textEnd < 0) { //@doc < 0代表内容全部为文本
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      /*
      * @doc
      * ([\\s\\S]*?) 空格非空格，匹配标签中的内容，对应replace第2个参数text
      * (</' + stackedTag + '[^>]*>) 匹配结束标签，如</div>，对应replace第3个参数endTag
      */
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()
  /*
  * @doc
  * html推进处理，并记录位置
  */
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    /*
    * @doc
    * start匹配后格式如下
    *  0: "<div"
    *  1: "div"
    *  groups: undefined
    *  index: 0
    *  input: "<div id="app" v-if="loading" @click.stop="showPop">↵    {{message}}↵  </div>"
    *  length: 2
    */
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1], //@doc startTagOpen第一个可捕获的括号是 ((?:${ncname}\\:)?${ncname})，对应的是标签名称，如div
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      /*
      * @doc
      * 获取所有属性，直到遇到结束标签或没有属性
      */
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        /*
        * @doc
        * attr格式如下：
        *   0: " id="app""
        *   1: "id"
        *   2: "="
        *   3: "app"
        *   4: undefined
        *   5: undefined
        *   groups: undefined
        *   index: 0
        *   input: " id="app" v-if="loading" @click.stop="showPop">↵    {{message}}↵  </div>"
        *   length: 6
        */
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1] //@doc 斜杠的位置，自闭合标签标记 />
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {   //@doc true
      /*
      * @doc
      *  isNonPhrasingTag非段落元素集合，参见https://html.spec.whatwg.org/multipage/indices.html#elements-3
      * 根据html规范，p元素只能包含Phrasing content，参加https://html.spec.whatwg.org/multipage/grouping-content.html#the-p-element
      */
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      /*
      * @doc
      * 只写左侧的tag，浏览器会自动补全的标签
      * colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source
      */
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }
    /*
    * @doc
    * isUnaryTag 自闭合标签  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr'
    */
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    /*
    * @doc
    * 重新处理attrs，使其结构简化为{name:'',value: '',start: '',end: ''}
    */
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || '' //@doc 3、4、5为属性对应的值
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    if (!unary) { // @doc 没有闭合标签（不是自闭合标签，并且没有/>结束符）
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }
    /*
    * @doc
    * 调用start，构造ASTElement
    */
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {  //@doc 查找未关闭的标签元素
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
