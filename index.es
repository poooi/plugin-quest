import { join } from 'path-extra'
import React, { Component } from 'react'
import { Grid, Row, Col, Input, Panel, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { sortBy, range, values } from 'lodash'
import { pluralize } from 'inflection'
import { connect } from 'react-redux'
import { extensionSelectorFactory } from 'views/utils/selectors'

import { reducer, readQuestInfo } from './redux'

const i18n__ = window.i18n["poi-plugin-quest-info"].__.bind(window.i18n["poi-plugin-quest-info"])

const EXTENSION_KEY = 'poi-plugin-quest-info'
const pluginDataSelector = extensionSelectorFactory(EXTENSION_KEY)

function __(s) {
  let tr = i18n__.apply(this, arguments)
  if (tr === s)
    tr = window.i18n.resources.__.apply(this, arguments)
  return tr
}

const filterNames = [
  'Quest Type',
  'Composition Quest',
  'Sortie Quest',
  'Exercise Quest',
  'Expedition Quest',
  'Supply/Docking Quest',
  'Arsenal Quest',
  'Modernization Quest',
  'Marriage Quest',
  'Daily Quest',
  'Weekly Quest',
  'Monthly Quest',
  'Quarterly Quest',
].map(__)

const categoryNames = [
  '',
  'Composition',
  'Sortie',
  'Exercise',
  'Expedition',
  'Supply/Docking',
  'Arsenal',
  'Modernization',
].map(__)

const typeNames = [
  '',
  'One-time Quest',
  'Daily Quest',
  'Weekly Quest',
  '-3rd/-7th/-0th',
  '-2nd/-8th',
  'Monthly Quest',
  'Quarterly Quest',
].map(__)

export const reactClass = connect(
  pluginDataSelector,
  ({
    readQuestInfo,
  }),
)(class PluginQuest extends Component {
  constructor(props) {
    super(props)
    this.state = {
      quest_filter: 0,
      quest_id: 0,
    }
    this.filterFuncs = this.constructor.initFilterFuncs()
  }

  static initFilterFuncs = () => {
    const filterFuncs = {}
    range(1, 8).forEach((i) => {
      filterFuncs[i] =
        (quest) => quest.category === i && quest.wiki_id.charAt(0) !== 'W'
    })
    filterFuncs[8] = (quest) => quest.wiki_id.charAt(0) === 'W'
    filterFuncs[9] = (quest) => [2, 4, 5].includes(quest.type)
    filterFuncs[10] = (quest) => quest.type === 3
    filterFuncs[11] = (quest) => quest.type === 6
    filterFuncs[12] = (quest) => quest.type === 7
    return filterFuncs
  }

  componentWillMount() {
    this.props.readQuestInfo(join(__dirname, 'assets', 'info'), __)
  }

  componentDidMount() {
    window.addEventListener('game.request', this.handleRequest)
  }

  componentWillUnmount() {
    window.removeEventListener('game.request', this.handleRequest)
  }

  handleFilterSelect = (e) => {
    this.setState({
      quest_id: 0,
      quest_filter: parseInt(e.target.value),
    })
  }

  handleQuestSelect = (e) => {
    this.setState({
      quest_id: parseInt(e.target.value),
    })
  }

  handlePrereqClick = (quest_id) => {
    const quest = this.props.quests[quest_id]
    const quest_filter = !quest ? 0 :
      [2, 4, 5].includes(quest.type) ? 9 :
      quest.type === 3 ? 10 :
      quest.type === 6 ? 11 :
      quest.type === 7 ? 12 :
      quest.wiki_id.charAt(0) === 'W' ? 8 :
      quest.category
    this.setState({
      quest_filter,
      quest_id: quest_id,
    })
  }

  handleRequest = (e) => {
    if (e.detail.path === '/kcsapi/api_req_quest/start') {
      const {api_quest_id} = e.detail.body
      this.handlePrereqClick(+api_quest_id)
    }
  }

  static renderQuestOption(quest) {
    return <option key={quest.game_id} value={quest.game_id}>{quest.wiki_id} - {quest.name}</option>
  }
  static filterQuestByStatus(quests, questStatus, status) {
    return values(quests).filter((quest) => quest && questStatus[quest.game_id] === status)
  }
  renderQuestLink = (qid) => {
    const quest = this.props.quests[qid] || {}
    return (
      <OverlayTrigger placement='left' overlay={
        <Tooltip id={`quest-link-${qid}`}>
          <strong>{quest.name}</strong><br />
          {categoryNames[quest.category]}-{typeNames[quest.type]}<br />
          {quest.condition}
        </Tooltip>}>
        <div className='tooltipTrigger'>
          <a onClick={this.handlePrereqClick.bind(this, qid)}>
            {quest.wiki_id} - {quest.name}
          </a>
        </div>
      </OverlayTrigger>
    )
  }

  render() {
    const {quests, questStatus} = this.props
    const {quest_id, quest_filter} = this.state
    const filterFunc = this.filterFuncs[quest_filter] || (() => false)
    const quests_filtered = sortBy(
      values(quests).filter((quest) => quest && filterFunc(quest)),
      'wiki_id')
    const quest_selected = quest_id ? quests[quest_id] : quests_filtered[0]

    return (
      <div id='quest-info' className='quest-info'>
        <link rel='stylesheet' href={join(__dirname, 'assets', 'quest.css')} />
        <Grid>
          <Row>
            <Col xs={12}>
              <Panel header={__('Select Quest')} bsStyle='primary'>
                <Input type='select'
                  label={__('Quest Type')}
                  value={quest_filter}
                  onChange={this.handleFilterSelect}
                  style={{marginBottom: 8}}
                >
                  {
                    filterNames.map((filter, idx) => {
                      // Please keep '=== false' as normally it will return the string itself
                      if (__("req.option.pluralize") === false && idx != 0)
                        filter = pluralize(filter)
                      return <option key={idx} value={idx}>{filter}</option>
                    })
                  }
                </Input>
                <Input type='select' label={__('Quest Name')} value={quest_id} onChange={this.handleQuestSelect}>
                  <option key={0}>{__('Quest Name')}</option>
                  <optgroup label={__('Operable')}>
                  {
                    this.constructor.filterQuestByStatus(quests_filtered, questStatus, 2)
                    .map(this.constructor.renderQuestOption)
                  }
                  </optgroup>
                  <optgroup label={__('Locked')}>
                  {
                    this.constructor.filterQuestByStatus(quests_filtered, questStatus, 3)
                    .map(this.constructor.renderQuestOption)
                  }
                  </optgroup>
                  <optgroup label={__('Completed')}>
                  {
                    this.constructor.filterQuestByStatus(quests_filtered, questStatus, 1)
                    .map(this.constructor.renderQuestOption)
                  }
                  </optgroup>
                </Input>
              </Panel>
            </Col>
          </Row>
          {quest_selected &&
            <Row>
              <Col xs={12}>
                <Panel header={__('Quest Information')} bsStyle='danger'>
                  <div>
                    <div className='questTitle'>{quest_selected.name}</div>
                    <div className='questType'>
                      {categoryNames[quest_selected.category]} - {typeNames[quest_selected.type]}
                    </div>
                  </div>
                  <Row>
                    <div className='questInfo'>
                      <Panel header={__('Reward')} bsStyle='info'>
                        <ul>
                          <li key='reward_fuel'>{__('Fuel')} {quest_selected.reward_fuel}</li>
                          <li key='reward_bullet'>{__('Ammo')} {quest_selected.reward_ammo}</li>
                          <li key='reward_steel'>{__('Steel')} {quest_selected.reward_steel}</li>
                          <li key='reward_alum'>{__('Bauxite')} {quest_selected.reward_bauxite}</li>
                          {
                            (quest_selected.reward_other || []).map((reward, i) => {
                              let name = __(reward.name)
                              if (reward.category)
                                name = __('「') + name + __('」')
                              const amount = reward.amount ? (' × ' + reward.amount) : ''
                              const category = __(reward.category || '')
                              return (
                                <li key={`reward_other_${i}`}>
                                  {category}{name}{amount}
                                </li>
                               )
                            })
                          }
                        </ul>
                      </Panel>
                      <Panel header={__('Note')} bsStyle='success'>
                        <div>
                          <div>{__('Requirement')}:</div>
                          <div className='reqDetail'>
                            <OverlayTrigger placement='left' overlay={<Tooltip id='questReqInfo'>{quest_selected.detail}</Tooltip>}>
                              <div className='tooltipTrigger'>{quest_selected.condition}</div>
                            </OverlayTrigger>
                          </div>
                          {(quest_selected.prerequisite || []).length !== 0 &&
                            <div>
                              <div>{__('Requires')}:</div>
                              {
                                quest_selected.prerequisite.map((qid, rqidx) =>
                                  <div className='prereqName' key={rqidx}>
                                    {this.renderQuestLink(qid)}
                                  </div>
                                )
                              }
                            </div>
                          }
                          {(quest_selected.postquest || []).length !== 0 &&
                            <div>
                              <div>{__('Unlocks')}:</div>
                              {
                                quest_selected.postquest.map((qid, uqidx) =>
                                  <div className='prereqName' key={uqidx}>
                                    {this.renderQuestLink(qid)}
                                  </div>
                                )
                              }
                            </div>
                          }
                        </div>
                      </Panel>
                    </div>
                  </Row>
                </Panel>
              </Col>
            </Row>
          }
        </Grid>
      </div>
    )
  }
})

const switchPluginPath = [
  '/kcsapi/api_get_member/questlist'
]

export {reducer, switchPluginPath}
