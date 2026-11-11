"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/style-to-object";
exports.ids = ["vendor-chunks/style-to-object"];
exports.modules = {

/***/ "(ssr)/./node_modules/style-to-object/esm/index.mjs":
/*!****************************************************!*\
  !*** ./node_modules/style-to-object/esm/index.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ StyleToObject)\n/* harmony export */ });\n/* harmony import */ var inline_style_parser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! inline-style-parser */ \"(ssr)/./node_modules/inline-style-parser/esm/index.mjs\");\n\n//#region src/index.ts\n/**\n* Parses inline style to object.\n*\n* @param style - Inline style.\n* @param iterator - Iterator.\n* @returns - Style object or null.\n*\n* @example Parsing inline style to object:\n*\n* ```js\n* import parse from 'style-to-object';\n* parse('line-height: 42;'); // { 'line-height': '42' }\n* ```\n*/\nfunction StyleToObject(style, iterator) {\n\tlet styleObject = null;\n\tif (!style || typeof style !== \"string\") return styleObject;\n\tconst declarations = (0,inline_style_parser__WEBPACK_IMPORTED_MODULE_0__[\"default\"])(style);\n\tconst hasIterator = typeof iterator === \"function\";\n\tdeclarations.forEach((declaration) => {\n\t\tif (declaration.type !== \"declaration\") return;\n\t\tconst { property, value } = declaration;\n\t\tif (hasIterator) iterator(property, value, declaration);\n\t\telse if (value) {\n\t\t\tstyleObject = styleObject ?? {};\n\t\t\tstyleObject[property] = value;\n\t\t}\n\t});\n\treturn styleObject;\n}\n//#endregion\n\n\n//# sourceMappingURL=index.mjs.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvc3R5bGUtdG8tb2JqZWN0L2VzbS9pbmRleC5tanMiLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBd0M7QUFDeEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXlCLElBQUksS0FBSztBQUNsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0JBQXNCLCtEQUFLO0FBQzNCO0FBQ0E7QUFDQTtBQUNBLFVBQVUsa0JBQWtCO0FBQzVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFO0FBQ0Y7QUFDQTtBQUNBO0FBQ29DOztBQUVwQyIsInNvdXJjZXMiOlsiL2FwcC9hcHBsZXQvbm9kZV9tb2R1bGVzL3N0eWxlLXRvLW9iamVjdC9lc20vaW5kZXgubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXJzZSBmcm9tIFwiaW5saW5lLXN0eWxlLXBhcnNlclwiO1xuLy8jcmVnaW9uIHNyYy9pbmRleC50c1xuLyoqXG4qIFBhcnNlcyBpbmxpbmUgc3R5bGUgdG8gb2JqZWN0LlxuKlxuKiBAcGFyYW0gc3R5bGUgLSBJbmxpbmUgc3R5bGUuXG4qIEBwYXJhbSBpdGVyYXRvciAtIEl0ZXJhdG9yLlxuKiBAcmV0dXJucyAtIFN0eWxlIG9iamVjdCBvciBudWxsLlxuKlxuKiBAZXhhbXBsZSBQYXJzaW5nIGlubGluZSBzdHlsZSB0byBvYmplY3Q6XG4qXG4qIGBgYGpzXG4qIGltcG9ydCBwYXJzZSBmcm9tICdzdHlsZS10by1vYmplY3QnO1xuKiBwYXJzZSgnbGluZS1oZWlnaHQ6IDQyOycpOyAvLyB7ICdsaW5lLWhlaWdodCc6ICc0MicgfVxuKiBgYGBcbiovXG5mdW5jdGlvbiBTdHlsZVRvT2JqZWN0KHN0eWxlLCBpdGVyYXRvcikge1xuXHRsZXQgc3R5bGVPYmplY3QgPSBudWxsO1xuXHRpZiAoIXN0eWxlIHx8IHR5cGVvZiBzdHlsZSAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIHN0eWxlT2JqZWN0O1xuXHRjb25zdCBkZWNsYXJhdGlvbnMgPSBwYXJzZShzdHlsZSk7XG5cdGNvbnN0IGhhc0l0ZXJhdG9yID0gdHlwZW9mIGl0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCI7XG5cdGRlY2xhcmF0aW9ucy5mb3JFYWNoKChkZWNsYXJhdGlvbikgPT4ge1xuXHRcdGlmIChkZWNsYXJhdGlvbi50eXBlICE9PSBcImRlY2xhcmF0aW9uXCIpIHJldHVybjtcblx0XHRjb25zdCB7IHByb3BlcnR5LCB2YWx1ZSB9ID0gZGVjbGFyYXRpb247XG5cdFx0aWYgKGhhc0l0ZXJhdG9yKSBpdGVyYXRvcihwcm9wZXJ0eSwgdmFsdWUsIGRlY2xhcmF0aW9uKTtcblx0XHRlbHNlIGlmICh2YWx1ZSkge1xuXHRcdFx0c3R5bGVPYmplY3QgPSBzdHlsZU9iamVjdCA/PyB7fTtcblx0XHRcdHN0eWxlT2JqZWN0W3Byb3BlcnR5XSA9IHZhbHVlO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBzdHlsZU9iamVjdDtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgU3R5bGVUb09iamVjdCBhcyBkZWZhdWx0IH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4Lm1qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/style-to-object/esm/index.mjs\n");

/***/ })

};
;