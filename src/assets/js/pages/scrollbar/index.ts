import * as View from "@itkyk/view";
import {CustomScrollbar} from "@itkyk/custom-scrollbar";
import {css, injectGlobal} from "@emotion/css";
import Code from "../../components/Organisms/Code";
import ViewPort from "../../components/Organisms/ViewPort";

class Scroller extends View.Page {
  private scrollbar: CustomScrollbar;
  constructor(props) {
    super(props);
    this.scrollbar = null;
    this.init(()=>{
      this.globalStyle();
      this.startScrollBar();
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

  style = () => {
    return {
      contentsWrap: css({
        display: "grid",
        gridTemplateColumns: "530px calc(100vw - 570px)",
        h2: {
          fontSize: "20px",
          fontWeight: 500,
        }
      }),
      wrap: css({
        position: "relative",
        width: "530px",
        paddingRight: "30px",
      }),
      contents: css({
        width: "500px",
        height: "500px",
        overflow: "scroll",
        msOverflowStyle: "none",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": {
          display: "none"
        }
      }),
      scrollWrap: css({
        position: "absolute",
        top: "20px",
        right: "0",
        height: "460px",
        width: "10px",
        backgroundColor: "#ccc",
      }),
      scrollBar: css({
        position: "absolute",
        left: 0,
        top: 0,
        width: "10px",
        height: "50px",
        backgroundColor: "#555"
      }),
      codes: css({
        fontSize: "13px!important"
      })
    }
  }
}

View.createComponent("#scrollbar", Scroller);
Code();
ViewPort();