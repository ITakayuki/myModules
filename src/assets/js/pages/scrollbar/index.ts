import * as View from "@itkyk/view";
import {CustomScrollbar} from "@itkyk/custom-scrollbar";
import {css, injectGlobal} from "@emotion/css";
import {f, v} from "../../modules/function";
import Code from "../../components/Organisms/Code";
import ViewPort from "../../components/Organisms/ViewPort";
import Links from "../../components/Organisms/Links";

class Scroller extends View.Page {
  private scrollbar: CustomScrollbar;
  constructor(props) {
    super(props);
    this.scrollbar = null;
    this.init(()=>{
      this.globalStyle();
      this.startScrollBar();
      this.setScrollbarHeight();
    })
  }

  startScrollBar = () => {
    this.scrollbar = new CustomScrollbar(this.refs.target, {})
  }

  globalStyle = () => {
    injectGlobal({
      "body": {
        padding: "20px"
      }
    })
  }

  setScrollbarHeight = () => {
    const wrapHeight = this.refs.wrap.getBoundingClientRect().height;
    const contentsWrapHeight = this.section.querySelector(".custom-scroll-contents").getBoundingClientRect().height;
    const contentsInnerHeight = this.section.querySelector(".custom-scrollbar-content-wrapper").getBoundingClientRect().height;
    const percent = contentsWrapHeight / contentsInnerHeight;
    const bar = this.refs.bar as HTMLDivElement;
    bar.style.height = `${wrapHeight * percent}px`;
  }

  style = () => {
    return {
      contentsWrap: css({
        [f.pc()]: {
          width: f.vw(530 + 600),
          margin: "0 auto"
        }
      }),
      wrap: css({
        position: "relative",
        paddingRight: "30px",
        [f.pc()]: {
          width: f.vw(530),
          margin: `${f.vw(20)} auto ${f.vw(20)} auto`,
          padding: f.vw(10),
          border: "solid 2px #999"
        }
      }),
      contents: css({
        msOverflowStyle: "none",
        scrollbarWidth: "none",
        overflow: "scroll",
        [f.pc()]: {
          width: f.vw(500),
          height:f.vw(400),
          fontSize: f.vw(15),
          h2: {
            fontSize: f.vw(20),
            fontWeight: 500,
          }
        },
        "&::-webkit-scrollbar": {
          display: "none"
        }
      }),
      scrollWrap: css({
        position: "absolute",
        width: "10px",
        backgroundColor: "#ccc",
        [f.pc()]: {
          top: f.vw(20),
          right: f.vw(5),
          height: f.vw(360),
        }
      }),
      scrollBar: css({
        position: "absolute",
        left: 0,
        top: 0,
        backgroundColor: "#555",
        [f.pc()]: {
          width: "10px",
        }
      }),
      codes: css({
        fontSize: "13px!important",
        [f.pc()]: {
          marginTop: f.vw(20)
        }
      }),
      heading: css({
        [f.pc()]: {
          fontSize: f.vw(25),
        }
      })
    }
  }
}

View.createComponent("#scrollbar", Scroller);
Code();
ViewPort();
Links();