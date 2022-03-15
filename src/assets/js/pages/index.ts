import * as View from "@itkyk/view";

class Test extends View.Page {
  constructor(props) {
    super(props);
    this.init(this.initialize);
  }

  initialize =() => {
    console.log(this.section);
    console.log("reference is ", this.refs);
  }

  clickFunc = () => {
    console.log("click!a")
  }

}

View.createComponent("#test", Test);


class Component extends View.Component {
  private counter: number;
  private test: string;
  private text:string;
  constructor(props) {
    super(props);
    this.init(()=>{
      console.log(this.refs);
    })
    this.counter = 0;
    this.test = "";
  }

  watch = () => {
    return {
      counter: () => {
        this.refs.count.innerHTML = `${this.counter}`
      },
      text: () => {
        console.log("change")
      }
    }
  }

  clickFunc = (e) => {
    this.counter ++;
    this.text += "a"
  }

  changeInput = (e) => {
    this.text = e.target.value;
  }
}

View.createComponent(".component", Component)