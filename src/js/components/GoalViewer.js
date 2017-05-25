var React = require('react');
import { RaisedButton, FlatButton, TextField,
  IconButton, Slider } from 'material-ui';
var MobileDialog = require('components/common/MobileDialog');
var api = require('utils/api');
var util = require('utils/util');
import {clone} from 'lodash';
var AppConstants = require('constants/AppConstants');
var ProgressLine = require('components/common/ProgressLine');
import {changeHandler} from 'utils/component-utils';

@changeHandler
export default class GoalViewer extends React.Component {
  static defaultProps = {
    goal_slots: AppConstants.GOAL_DEFAULT_SLOTS
  }

  static propTypes = {
    goal_slots: React.PropTypes.number
  }

  constructor(props) {
      super(props);
      this.state = {
          annual: null,
          monthly: null,
          longterm: null,
          set_goal_form: null,  // Which goal to show form for (date str or 'longterm')
          form: {},
          assessment_form: {assessment: 1}
      };
      this.ASSESS_LABELS = ["Very Poorly", "Poorly", "OK", "Well", "Very Well"];
      this.ASSESSMENT_DAY = 26;
      this.GOAL_M_FORMAT = "YYYY-MM";
      this.GOAL_M_LABEL_FORMAT = "MMM YYYY";
  }

  componentDidMount() {
    this.fetch_current();
  }

  handle_text_change(i, e) {
    let val = e.currentTarget.value;
    let {form} = this.state;
    form.text[i] = val;
    this.setState({form});
  }

  add_goal() {
    let {form} = this.state;
    form.text.push('');
    this.setState({form});
  }

  remove_goal(i) {
    let {form} = this.state;
    form.text.splice(i, 1);
    this.setState({form});
  }

  update_goal(params) {
    api.post("/api/goal", params, (res) => {
      let g = res.goal;
      let st = {};
      if (g.annual) st.annual = g;
      else if (g.monthly) st.monthly = g;
      else if (g.longterm) st.longterm = g;
      st.set_goal_form = null;
      this.setState(st);
    })
  }

  save_goals() {
    let params = clone(this.state.form)
    params.id = this.state.set_goal_form
    params.text = JSON.stringify(params.text)
    this.update_goal(params);
  }

  save_assessment(g) {
    let {assessment_form} = this.state;
    let params = {
      id: g.id,
      assessment: assessment_form.assessment
    }
    this.update_goal(params);
  }

  dismiss() {
    this.setState({set_goal_form: null, set_goal_label: null});
  }

  in_assessment_window() {
    let today = new Date();
    return today.getDate() >= this.ASSESSMENT_DAY;
  }

  fetch_current() {
    api.get("/api/goal/current", {}, (res) => {
      let st = {annual: res.annual, monthly: res.monthly, longterm: res.longterm};
      this.setState(st);
    });
  }

  show_longterm() {
    if (this.state.longterm) this.show_goal_dialog(this.state.longterm, 'longterm');
    else this.setState({set_goal_form: 'longterm', set_goal_label: 'long term', form: {}});
  }

  show_goal_dialog(g, type) {
      let today = new Date();
      let form = {};
      if (g) {
        form = clone(g);
      }
      let id, label;
      if (type == 'annual') id = today.getFullYear();
      else if (type == 'monthly') {
        let time = today.getTime();
        id = util.printDate(time, this.GOAL_M_FORMAT);
        label = util.printDate(time, this.GOAL_M_LABEL_FORMAT);
      }
      else if (type == 'longterm') id = 'longterm';
      let st = {
        form: form,
        set_goal_form: id,
        set_goal_label: label == null ? id : label
      };
      this.setState(st);
  }

  render_set_goal_form() {
    let {set_goal_form, form} = this.state;
    let goal_slots = Math.min(this.props.goal_slots, AppConstants.GOAL_MAX_SLOTS)
    if (set_goal_form) {
      let _inputs = form.text.map((t, i) => {
        return (
          <div className="row" key={i}>
            <div className="col-sm-11">
              <TextField
                placeholder={`Goal ${i+1}`} value={t || ''} name={"g"+i}
                onChange={this.handle_text_change.bind(this, i)}
                fullWidth autoFocus={t == null || t.length == 0} />
            </div>
            <div className="col-sm-1">
              <div className="center-block">
                <IconButton iconClassName="material-icons" tooltip="Remove Goal" tooltipPosition="bottom-left" onClick={this.remove_goal.bind(this, i)}>cancel</IconButton>
              </div>
            </div>
          </div>
        )
      })
      let can_add = form.text.length < goal_slots;
      let _add;
      if (can_add) _add = <FlatButton label="Add Goal" onClick={this.add_goal.bind(this)} />
      return (
        <div>
          { _inputs }
          { _add }
        </div>
      )
    } else return null;
  }

  render_goal(g, type) {
    let {assessment_form} = this.state;
    let goal_list, create_prompt;
    let today = new Date();
    let date_printed = "";
    let date = new Date();
    let value = 0;
    let total = 100;
    if (type == 'annual') {
      date_printed = date.getFullYear();
      value = util.dayOfYear(today);
      total = 365;
    } else {
      date_printed = util.printDate(date.getTime(), "MMMM YYYY");
      value = today.getDate();
      total = util.daysInMonth(date.getMonth()+1, date.getFullYear());
    }
    let show_assessment = g && this.in_assessment_window() && !g.annual && !g.assessment;
    let assess_label = this.ASSESS_LABELS[(assessment_form.assessment-1)];
    if (g) {
      goal_list = (
        <ul className="goalList">
          { g.text.map((txt, j) => {
            return <li key={j}>{txt}</li>
          }) }
        </ul>
      );
    } else {
      create_prompt = (
        <div className="empty"><a href="javascript:void(0)" onClick={this.show_goal_dialog.bind(this, g, type)}>Set goals</a> for { date_printed }</div>
        );
    }
    return (
      <div className="goal col-sm-6" key={type}>
        <a href="javascript:void(0)" className="goalDate" onClick={this.show_goal_dialog.bind(this, g, type)}>{ date_printed }</a>
        <ProgressLine value={value} total={total} />

        { goal_list }
        { create_prompt }

        <div hidden={!show_assessment}>
          <p className="lead">The month is almost over - how&apos;d you do?</p>

          <Slider name='assessment' value={assessment_form.assessment} onChange={this.changeHandlerSlider.bind(this, 'assessment_form', 'assessment')} max={5} min={1} defaultValue={1} step={1} />
          <RaisedButton label={`Submit Assessment (${assess_label})`} onClick={this.save_assessment.bind(this, g)} primary={true} />
        </div>
      </div>
    );
  }

  render() {
    let {annual, monthly, set_goal_form, set_goal_label} = this.state;
    let goal_label;
    if (set_goal_label) goal_label = set_goal_label;
    let _goals = (
      <div className="row">
        { this.render_goal(monthly, 'monthly') }
        { this.render_goal(annual, 'annual') }
      </div>
    )
    let actions = [
      <RaisedButton label="Save Goals" onClick={this.save_goals.bind(this)} primary={true} />,
      <FlatButton label="Later" onClick={this.dismiss.bind(this)} />
    ]
    return (
      <div className="GoalsViewer">
        <div className="row">
          <div className="col-sm-6">
            <h3>Goals</h3>
          </div>
          <div className="col-sm-6">
            <span className="pull-right"><IconButton tooltip="Longterm Goals" iconClassName="material-icons" onClick={this.show_longterm.bind(this)}>call_made</IconButton></span>
          </div>
        </div>

        { _goals }

        <MobileDialog open={set_goal_form != null}
                title={`Set ${goal_label} goals`}
                actions={actions}
                onRequestClose={this.dismiss.bind(this)}>
          { this.render_set_goal_form() }
        </MobileDialog>
      </div>
    )
  }
}
