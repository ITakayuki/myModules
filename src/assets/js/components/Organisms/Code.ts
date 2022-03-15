import * as View from "@itkyk/view";
import {css} from "@emotion/css";

class Code extends View.Component {
  constructor(props) {
    super(props);
    console.log(this)
    this.init(()=>{

    })
  }

  style = () => {
    return {
      wrap: css({
        width: "100%"
      }),
      title: css({
        fontSize: "20px",
        marginBottom: "-50px"
      })
    }
  }
}

export default () => View.createComponent(".code", Code);