import * as View from "@itkyk/view";
import {css} from "@emotion/css";

class Code extends View.Component {
  constructor(props) {
    super(props);
    this.init(()=>{

    })
  }

  clickJS = (e: Event) => {
    this.clearActive();
    const target = e.target as HTMLButtonElement;
    const tag = target.getAttribute("data-type");
    this.refs[tag].classList.add("is-active");
    target.classList.add("is-active");
  }

  clearActive = () => {
    const tags = ["js", "html", "css"];
    for (const tag of tags) {
      this.refs[tag].classList.remove("is-active");
    }
    const buttonArray = this.refs.buttons.querySelectorAll("button");
    for (const button of buttonArray) {
      button.classList.remove("is-active");
    }
  }

  style = () => {
    return {
      wrap: css({
        width: "100%"
      }),
      title: css({
        fontSize: "20px",
        marginBottom: "-50px"
      }),
      codeBox: css({
        display: "none",
        "&.is-active": {
          display: "block"
        }
      }),
      buttons: css({
        display: "grid",
        gridTemplateColumns: "33% 33% 33%",
        gridTemplateRows: "50px",
        button: {
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#fff",
          color: "#000",
          border: "solid 1px #000",
          "&.is-active": {
            backgroundColor: "#000",
            color: "#fff"
          }
        }
      })
    }
  }
}

export default () => View.createComponent(".code", Code);