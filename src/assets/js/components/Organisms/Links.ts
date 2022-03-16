import * as View from "@itkyk/view";
import {css} from "@emotion/css";
import {f, v} from "../../modules/function";

class Links extends View.Component {
  constructor(props) {
    super(props);
    this.init(()=>{})
  }

  style = () => {
    return {
      wrap: css({
        [f.pc()]: {
          display: "grid",
          gridTemplateColumns: `${f.vw(45)} ${f.vw(45)} ${f.vw(55)}`,
          gridTemplateRows: f.vw(25),
          marginTop: f.vw(20),
        },
      }),
      iconWrap: css({
        width: "100%",
        [f.pc()]: {
          paddingRight: f.vw(20)
        },
        a: {
          position: "relative",
          display: "inline-block",
          width: "100%",
          height: "100%",
          transition: "opacity 0.2s ease-out",
          opacity: "1",
          "&:hover": {
            opacity: 0.6,
          },
          img: {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)"
          }
        }
      })
    }
  }
}

export default ()=>View.createComponent(".links", Links)