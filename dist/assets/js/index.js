(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComponent = exports.Component = exports.Page = void 0;
class Base {
    constructor(_tag) {
        this.setEmotion = () => {
            var _a;
            let style = null;
            if (this.style) {
                style = this.style();
            }
            if (style) {
                const selector = `[${this.tag}-css]`;
                const styleTargets = (_a = this.section) === null || _a === void 0 ? void 0 : _a.querySelectorAll(selector);
                if (styleTargets) {
                    for (const target of styleTargets) {
                        const selector = target.getAttribute(`${this.tag}-css`);
                        // @ts-ignore
                        target.classList.add(style[selector]);
                    }
                }
            }
        };
        this.startWatcher = (keys) => {
            Object.keys(keys).forEach((key) => {
                // @ts-ignore
                let lastVal = this[key];
                this.watchFuncs[key] = () => {
                    // @ts-ignore
                    if (this[key] !== lastVal) {
                        // @ts-ignore
                        lastVal = this[key];
                        keys[key]();
                    }
                    requestAnimationFrame(this.watchFuncs[key]);
                };
                this.watchFuncs[key]();
            });
        };
        this._addEvents = () => {
            const events = ["click", "scroll", "load", "mouseenter", "mouseleave", "mouseover", "change"];
            for (const event of events) {
                const eventName = `${this.tag}-${event}`;
                if (this.section !== undefined && this.section !== null) {
                    const targets = this.section.querySelectorAll("[" + eventName + "]");
                    for (const target of targets) {
                        const func = target.getAttribute(eventName);
                        const addFunc = (e) => {
                            if (func !== null) {
                                // @ts-ignore
                                this[func](e);
                            }
                        };
                        target.addEventListener(event, addFunc);
                    }
                }
            }
        };
        this.tag = _tag;
        this.refs = {};
        this.watchFuncs = {};
    }
    init(cb) {
        if (this.section) {
            this._addEvents();
            this.getReference();
            this.setWatch();
            this.setEmotion();
            if (cb) {
                cb();
            }
        }
    }
    setWatch() {
        if (this.watch !== undefined) {
            const callback = this.watch();
            this.startWatcher(callback);
        }
    }
    removeWatch() {
        Object.keys(this.watchFuncs).forEach((key) => {
            // @ts-ignore
            clearInterval(this.watchFuncs[key]);
        });
    }
    getReference() {
        const tag = `${this.tag}-ref`;
        if (this.section) {
            const refs = this.section.querySelectorAll(`[${tag}]`);
            for (const ref of refs) {
                const attribute = ref.getAttribute(tag);
                if (attribute) {
                    this.refs[attribute] = ref;
                }
            }
        }
    }
    destroy() {
        // @ts-ignore
        if (this.beforeDestroy) {
            // @ts-ignore
            this.beforeDestroy();
        }
    }
}
class Page extends Base {
    constructor(_tag, num = null) {
        super(_tag);
        this.tag = _tag;
        this.section = document.getElementById(_tag);
    }
}
exports.Page = Page;
class Component extends Base {
    constructor(props) {
        super(props.tag);
        this.section = props.component;
    }
}
exports.Component = Component;
function createComponent(_tagName, _class) {
    const targets = document.querySelectorAll(_tagName);
    const refactorTag = _tagName.replace("#", "").replace(".", "");
    const classes = [];
    if (_tagName.includes("#")) {
        for (const target of targets) {
            classes.push(new _class(refactorTag));
        }
    }
    else if (_tagName.includes(".")) {
        for (const target of targets) {
            classes.push(new _class({ component: target, tag: refactorTag }));
        }
    }
    return classes;
}
exports.createComponent = createComponent;

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const View = require("@itkyk/view");
class Test extends View.Page {
    constructor(props) {
        super(props);
        this.initialize = () => {
            console.log(this.section);
            console.log("reference is ", this.refs);
        };
        this.clickFunc = () => {
            console.log("click!a");
        };
        this.init(this.initialize);
    }
}
View.createComponent("#test", Test);
class Component extends View.Component {
    constructor(props) {
        super(props);
        this.watch = () => {
            return {
                counter: () => {
                    this.refs.count.innerHTML = `${this.counter}`;
                },
                text: () => {
                    console.log("change");
                }
            };
        };
        this.clickFunc = (e) => {
            this.counter++;
            this.text += "a";
        };
        this.changeInput = (e) => {
            this.text = e.target.value;
        };
        this.init(() => {
            console.log(this.refs);
        });
        this.counter = 0;
        this.test = "";
    }
}
View.createComponent(".component", Component);

},{"@itkyk/view":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvQGl0a3lrL3ZpZXcvZGlzdC9pbmRleC5qcyIsInNyYy9hc3NldHMvanMvcGFnZXMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6SUEsb0NBQW9DO0FBRXBDLE1BQU0sSUFBSyxTQUFRLElBQUksQ0FBQyxJQUFJO0lBQzFCLFlBQVksS0FBSztRQUNmLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUlmLGVBQVUsR0FBRSxHQUFHLEVBQUU7WUFDZixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDMUMsQ0FBQyxDQUFBO1FBRUQsY0FBUyxHQUFHLEdBQUcsRUFBRTtZQUNmLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUE7UUFDeEIsQ0FBQyxDQUFBO1FBVkMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDN0IsQ0FBQztDQVdGO0FBRUQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFHcEMsTUFBTSxTQUFVLFNBQVEsSUFBSSxDQUFDLFNBQVM7SUFJcEMsWUFBWSxLQUFLO1FBQ2YsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBUWYsVUFBSyxHQUFHLEdBQUcsRUFBRTtZQUNYLE9BQU87Z0JBQ0wsT0FBTyxFQUFFLEdBQUcsRUFBRTtvQkFDWixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUE7Z0JBQy9DLENBQUM7Z0JBQ0QsSUFBSSxFQUFFLEdBQUcsRUFBRTtvQkFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFBO2dCQUN2QixDQUFDO2FBQ0YsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQUVELGNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQ2hCLElBQUksQ0FBQyxPQUFPLEVBQUcsQ0FBQztZQUNoQixJQUFJLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQTtRQUNsQixDQUFDLENBQUE7UUFFRCxnQkFBVyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDbEIsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUM3QixDQUFDLENBQUE7UUF6QkMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFFLEVBQUU7WUFDWixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QixDQUFDLENBQUMsQ0FBQTtRQUNGLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLENBQUM7Q0FxQkY7QUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5jcmVhdGVDb21wb25lbnQgPSBleHBvcnRzLkNvbXBvbmVudCA9IGV4cG9ydHMuUGFnZSA9IHZvaWQgMDtcbmNsYXNzIEJhc2Uge1xuICAgIGNvbnN0cnVjdG9yKF90YWcpIHtcbiAgICAgICAgdGhpcy5zZXRFbW90aW9uID0gKCkgPT4ge1xuICAgICAgICAgICAgdmFyIF9hO1xuICAgICAgICAgICAgbGV0IHN0eWxlID0gbnVsbDtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0eWxlKSB7XG4gICAgICAgICAgICAgICAgc3R5bGUgPSB0aGlzLnN0eWxlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3R5bGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWxlY3RvciA9IGBbJHt0aGlzLnRhZ30tY3NzXWA7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3R5bGVUYXJnZXRzID0gKF9hID0gdGhpcy5zZWN0aW9uKSA9PT0gbnVsbCB8fCBfYSA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2EucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICAgICAgICAgICAgaWYgKHN0eWxlVGFyZ2V0cykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiBzdHlsZVRhcmdldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdG9yID0gdGFyZ2V0LmdldEF0dHJpYnV0ZShgJHt0aGlzLnRhZ30tY3NzYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQuY2xhc3NMaXN0LmFkZChzdHlsZVtzZWxlY3Rvcl0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLnN0YXJ0V2F0Y2hlciA9IChrZXlzKSA9PiB7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyhrZXlzKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RWYWwgPSB0aGlzW2tleV07XG4gICAgICAgICAgICAgICAgdGhpcy53YXRjaEZ1bmNzW2tleV0gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXNba2V5XSAhPT0gbGFzdFZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdFZhbCA9IHRoaXNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXNba2V5XSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLndhdGNoRnVuY3Nba2V5XSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB0aGlzLndhdGNoRnVuY3Nba2V5XSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX2FkZEV2ZW50cyA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IFtcImNsaWNrXCIsIFwic2Nyb2xsXCIsIFwibG9hZFwiLCBcIm1vdXNlZW50ZXJcIiwgXCJtb3VzZWxlYXZlXCIsIFwibW91c2VvdmVyXCIsIFwiY2hhbmdlXCJdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBldmVudE5hbWUgPSBgJHt0aGlzLnRhZ30tJHtldmVudH1gO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNlY3Rpb24gIT09IHVuZGVmaW5lZCAmJiB0aGlzLnNlY3Rpb24gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0cyA9IHRoaXMuc2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKFwiW1wiICsgZXZlbnROYW1lICsgXCJdXCIpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmdW5jID0gdGFyZ2V0LmdldEF0dHJpYnV0ZShldmVudE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYWRkRnVuYyA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZ1bmMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2Z1bmNdKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgYWRkRnVuYyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMudGFnID0gX3RhZztcbiAgICAgICAgdGhpcy5yZWZzID0ge307XG4gICAgICAgIHRoaXMud2F0Y2hGdW5jcyA9IHt9O1xuICAgIH1cbiAgICBpbml0KGNiKSB7XG4gICAgICAgIGlmICh0aGlzLnNlY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZEV2ZW50cygpO1xuICAgICAgICAgICAgdGhpcy5nZXRSZWZlcmVuY2UoKTtcbiAgICAgICAgICAgIHRoaXMuc2V0V2F0Y2goKTtcbiAgICAgICAgICAgIHRoaXMuc2V0RW1vdGlvbigpO1xuICAgICAgICAgICAgaWYgKGNiKSB7XG4gICAgICAgICAgICAgICAgY2IoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBzZXRXYXRjaCgpIHtcbiAgICAgICAgaWYgKHRoaXMud2F0Y2ggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgY2FsbGJhY2sgPSB0aGlzLndhdGNoKCk7XG4gICAgICAgICAgICB0aGlzLnN0YXJ0V2F0Y2hlcihjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmVtb3ZlV2F0Y2goKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMud2F0Y2hGdW5jcykuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMud2F0Y2hGdW5jc1trZXldKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGdldFJlZmVyZW5jZSgpIHtcbiAgICAgICAgY29uc3QgdGFnID0gYCR7dGhpcy50YWd9LXJlZmA7XG4gICAgICAgIGlmICh0aGlzLnNlY3Rpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHJlZnMgPSB0aGlzLnNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbChgWyR7dGFnfV1gKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIHJlZnMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGUgPSByZWYuZ2V0QXR0cmlidXRlKHRhZyk7XG4gICAgICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnNbYXR0cmlidXRlXSA9IHJlZjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBpZiAodGhpcy5iZWZvcmVEZXN0cm95KSB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICB0aGlzLmJlZm9yZURlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbmNsYXNzIFBhZ2UgZXh0ZW5kcyBCYXNlIHtcbiAgICBjb25zdHJ1Y3RvcihfdGFnLCBudW0gPSBudWxsKSB7XG4gICAgICAgIHN1cGVyKF90YWcpO1xuICAgICAgICB0aGlzLnRhZyA9IF90YWc7XG4gICAgICAgIHRoaXMuc2VjdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKF90YWcpO1xuICAgIH1cbn1cbmV4cG9ydHMuUGFnZSA9IFBhZ2U7XG5jbGFzcyBDb21wb25lbnQgZXh0ZW5kcyBCYXNlIHtcbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcy50YWcpO1xuICAgICAgICB0aGlzLnNlY3Rpb24gPSBwcm9wcy5jb21wb25lbnQ7XG4gICAgfVxufVxuZXhwb3J0cy5Db21wb25lbnQgPSBDb21wb25lbnQ7XG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoX3RhZ05hbWUsIF9jbGFzcykge1xuICAgIGNvbnN0IHRhcmdldHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKF90YWdOYW1lKTtcbiAgICBjb25zdCByZWZhY3RvclRhZyA9IF90YWdOYW1lLnJlcGxhY2UoXCIjXCIsIFwiXCIpLnJlcGxhY2UoXCIuXCIsIFwiXCIpO1xuICAgIGNvbnN0IGNsYXNzZXMgPSBbXTtcbiAgICBpZiAoX3RhZ05hbWUuaW5jbHVkZXMoXCIjXCIpKSB7XG4gICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGNsYXNzZXMucHVzaChuZXcgX2NsYXNzKHJlZmFjdG9yVGFnKSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAoX3RhZ05hbWUuaW5jbHVkZXMoXCIuXCIpKSB7XG4gICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGNsYXNzZXMucHVzaChuZXcgX2NsYXNzKHsgY29tcG9uZW50OiB0YXJnZXQsIHRhZzogcmVmYWN0b3JUYWcgfSkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjbGFzc2VzO1xufVxuZXhwb3J0cy5jcmVhdGVDb21wb25lbnQgPSBjcmVhdGVDb21wb25lbnQ7XG4iLCJpbXBvcnQgKiBhcyBWaWV3IGZyb20gXCJAaXRreWsvdmlld1wiO1xuXG5jbGFzcyBUZXN0IGV4dGVuZHMgVmlldy5QYWdlIHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5pbml0KHRoaXMuaW5pdGlhbGl6ZSk7XG4gIH1cblxuICBpbml0aWFsaXplID0oKSA9PiB7XG4gICAgY29uc29sZS5sb2codGhpcy5zZWN0aW9uKTtcbiAgICBjb25zb2xlLmxvZyhcInJlZmVyZW5jZSBpcyBcIiwgdGhpcy5yZWZzKTtcbiAgfVxuXG4gIGNsaWNrRnVuYyA9ICgpID0+IHtcbiAgICBjb25zb2xlLmxvZyhcImNsaWNrIWFcIilcbiAgfVxuXG59XG5cblZpZXcuY3JlYXRlQ29tcG9uZW50KFwiI3Rlc3RcIiwgVGVzdCk7XG5cblxuY2xhc3MgQ29tcG9uZW50IGV4dGVuZHMgVmlldy5Db21wb25lbnQge1xuICBwcml2YXRlIGNvdW50ZXI6IG51bWJlcjtcbiAgcHJpdmF0ZSB0ZXN0OiBzdHJpbmc7XG4gIHByaXZhdGUgdGV4dDpzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMuaW5pdCgoKT0+e1xuICAgICAgY29uc29sZS5sb2codGhpcy5yZWZzKTtcbiAgICB9KVxuICAgIHRoaXMuY291bnRlciA9IDA7XG4gICAgdGhpcy50ZXN0ID0gXCJcIjtcbiAgfVxuXG4gIHdhdGNoID0gKCkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICBjb3VudGVyOiAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVmcy5jb3VudC5pbm5lckhUTUwgPSBgJHt0aGlzLmNvdW50ZXJ9YFxuICAgICAgfSxcbiAgICAgIHRleHQ6ICgpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjaGFuZ2VcIilcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjbGlja0Z1bmMgPSAoZSkgPT4ge1xuICAgIHRoaXMuY291bnRlciArKztcbiAgICB0aGlzLnRleHQgKz0gXCJhXCJcbiAgfVxuXG4gIGNoYW5nZUlucHV0ID0gKGUpID0+IHtcbiAgICB0aGlzLnRleHQgPSBlLnRhcmdldC52YWx1ZTtcbiAgfVxufVxuXG5WaWV3LmNyZWF0ZUNvbXBvbmVudChcIi5jb21wb25lbnRcIiwgQ29tcG9uZW50KSJdfQ==
