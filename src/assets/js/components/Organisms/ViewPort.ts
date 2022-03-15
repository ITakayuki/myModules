import * as View from "@itkyk/view";
import {css} from "@emotion/css";

class ViewPort extends View.Component {
  constructor(props) {
    super(props);
    this.init(()=>{

    })
  }

  style = () => {
    return {
      wrap: css({
        marginTop: "20px"
      }),
      title: css({
        fontSize: "20px",
        marginBottom: "20px"
      }),
      contents: css({
        border: "solid 1px #ccc"
      }),
    }
  }
}

export default () => View.createComponent(".viewport", ViewPort)