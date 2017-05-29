import { join } from 'path-extra'
import React, { Component } from 'react'
import { Grid, Row, Col, Panel, OverlayTrigger, Tooltip, Dropdown, MenuItem, ButtonGroup } from 'react-bootstrap'
import { sortBy, range, values, get } from 'lodash'
import { pluralize } from 'inflection'
import { connect } from 'react-redux'
import { extensionSelectorFactory } from 'views/utils/selectors'

import { reducer, readQuestInfo } from './redux'

const i18n__ = window.i18n['poi-plugin-quest-info'].__.bind(window.i18n['poi-plugin-quest-info'])

const EXTENSION_KEY = 'poi-plugin-quest-info'
const pluginDataSelector = extensionSelectorFactory(EXTENSION_KEY)

const __ = (s, ...args) => {
  let tr = i18n__(s, ...args)
  if (tr === s) {
    tr = window.i18n.resources.__(s, ...args)
  }
  return tr
}

const filterNames = [
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
  'Composition',
  'Sortie',
  'Exercise',
  'Expedition',
  'Supply/Docking',
  'Arsenal',
  'Modernization',
].map(__)

const categoryColors = [
  '#19BB2E',
  '#e73939',
  '#87da61',
  '#16C2A3',
  '#E2C609',
  '#805444',
  '#c792e8',
]

const typeNames = [
  'One-time Quest',
  'Daily Quest',
  'Weekly Quest',
  '-3rd/-7th/-0th',
  '-2nd/-8th',
  'Monthly Quest',
  'Quarterly Quest',
].map(__)

const FilterItem = ({ index }) => (
  <span>
    {
      categoryColors[index] &&
      <span className="cat-indicator" style={{ backgroundColor: categoryColors[index] }}></span>
    }
    {
      (__('req.option.pluralize') === true && index !== 0)
      ? pluralize(filterNames[index])
      : filterNames[index]
    }
  </span>
)

const QuestItem = ({ quest = {} }) => (
  <span>
    <span className="cat-indicator" style={{ backgroundColor: categoryColors[quest.category - 1] }}></span>
    {quest.wiki_id} - {quest.name}
  </span>
)

export const reactClass = connect(
  pluginDataSelector,
  ({
    readQuestInfo,
  }),
)(class PluginQuest extends Component {
  constructor(props) {
    super(props)
    this.filterFuncs = this.constructor.initFilterFuncs()
    this.state = {
      questFilter: 0,
      questId: 101,
    }
  }

  static initFilterFuncs = () => {
    const filterFuncs = {}
    range(0, 7).forEach((i) => {
      filterFuncs[i] =
        quest => quest.category === i + 1 && quest.wiki_id.charAt(0) !== 'W'
    })
    filterFuncs[7] = quest => quest.wiki_id.charAt(0) === 'W'
    filterFuncs[8] = quest => [2, 4, 5].includes(quest.type)
    filterFuncs[9] = quest => quest.type === 3
    filterFuncs[10] = quest => quest.type === 6
    filterFuncs[11] = quest => quest.type === 7
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

  getDefaultQuestId(questFilter = 0) {
    return get(sortBy(
      values(this.props.quests).filter(quest => quest && this.filterFuncs[questFilter](quest)),
      'wiki_id'), '0.game_id', 0)
  }

  handleFileterSelect = (eventKey) => {
    const questFilter = parseInt(eventKey, 10)
    const questId = this.getDefaultQuestId(questFilter)
    this.setState({
      questId,
      questFilter,
    })
  }

  handleQuestSelect = (eventKey) => {
    this.setState({
      questId: parseInt(eventKey, 10),
    })
  }

  handlePrereqClick = questId => () => {
    const quest = this.props.quests[questId]
    let questFilter

    switch (true) {
      case !quest:
        questFilter = 0
        break
      case [2, 4, 5].includes(quest.type):
        questFilter = 8
        break
      case quest.type === 3:
        questFilter = 9
        break
      case quest.type === 6:
        questFilter = 10
        break
      case quest.type === 7:
        questFilter = 11
        break
      case quest.wiki_id.charAt(0) === 'W':
        questFilter = 7
        break
      default:
        questFilter = quest.category - 1
    }

    this.setState({
      questFilter,
      questId,
    })
  }

  handleRequest = (e) => {
    if (e.detail.path === '/kcsapi/api_req_quest/start') {
      const {api_quest_id} = e.detail.body
      this.handlePrereqClick(+api_quest_id)
    }
  }

  static renderQuestOption(quest) {
    return <MenuItem key={quest.game_id} eventKey={quest.game_id}><QuestItem quest={quest} /></MenuItem>
  }
  static filterQuestByStatus(quests, questStatus, status) {
    return values(quests).filter(quest => quest && questStatus[quest.game_id] === status)
  }
  renderQuestLink = (qid) => {
    const quest = this.props.quests[qid] || {}
    return (
      <OverlayTrigger
        placement="left"
        overlay={
          <Tooltip id={`quest-link-${qid}`}>
            <strong>{quest.name}</strong><br />
            {categoryNames[quest.category]}-{typeNames[quest.type]}<br />
            {quest.condition}
          </Tooltip>}
      >
        <div className="tooltipTrigger">
          <a onClick={this.handlePrereqClick(qid)}>
            <QuestItem quest={quest} />
          </a>
        </div>
      </OverlayTrigger>
    )
  }

  render() {
    const { quests, questStatus } = this.props
    const { questId, questFilter } = this.state
    const filterFunc = this.filterFuncs[questFilter] || (() => false)
    const questsFiltered = sortBy(
      values(quests).filter(quest => quest && filterFunc(quest)),
      'wiki_id')
    const questSelected = (questId ? quests[questId] : questsFiltered[0]) || {}

    return (
      <div id="quest-info" className="quest-info">
        <link rel="stylesheet" href={join(__dirname, 'assets', 'quest.css')} />
        <Grid>
          <Row>
            <Col xs={12}>
              <ButtonGroup vertical block>
                <Dropdown
                  id="quest-type-filter"
                  onSelect={this.handleFileterSelect}
                >
                  <Dropdown.Toggle>
                    <FilterItem index={questFilter} />
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {
                      filterNames.map((name, idx) => (
                        // Please keep '=== true' as normally it will return the string itself
                        <MenuItem key={name} eventKey={idx}>
                          <FilterItem index={idx} />
                        </MenuItem>
                      ))
                    }
                  </Dropdown.Menu>
                </Dropdown>
                <Dropdown
                  id="quest-name-select"
                  onSelect={this.handleQuestSelect}
                >
                  <Dropdown.Toggle>
                    <QuestItem quest={questSelected} />
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <MenuItem header>{__('Operable')}</MenuItem>
                    {
                    this.constructor.filterQuestByStatus(questsFiltered, questStatus, 2)
                    .map(this.constructor.renderQuestOption)
                    }
                    <MenuItem header>{__('Locked')}</MenuItem>
                    {
                    this.constructor.filterQuestByStatus(questsFiltered, questStatus, 3)
                    .map(this.constructor.renderQuestOption)
                    }
                    <MenuItem header>{__('Completed')}</MenuItem>
                    {
                    this.constructor.filterQuestByStatus(questsFiltered, questStatus, 1)
                    .map(this.constructor.renderQuestOption)
                    }
                  </Dropdown.Menu>
                </Dropdown>
              </ButtonGroup>
            </Col>
          </Row>
          {questSelected &&
            <Row>
              <Col xs={12}>
                <Panel>
                  <div>
                    <div className="questTitle">{questSelected.name}</div>
                    <div className="questType">
                      {categoryNames[questSelected.category]} - {typeNames[questSelected.type]}
                    </div>
                  </div>
                  <Row>
                    <div className="questInfo">
                      <Panel header={__('Reward')} bsStyle="info">
                        <ul>
                          <li key="reward_fuel">{__('Fuel')} {questSelected.reward_fuel}</li>
                          <li key="reward_bullet">{__('Ammo')} {questSelected.reward_ammo}</li>
                          <li key="reward_steel">{__('Steel')} {questSelected.reward_steel}</li>
                          <li key="reward_alum">{__('Bauxite')} {questSelected.reward_bauxite}</li>
                          {
                            (questSelected.reward_other || []).map((reward) => {
                              let name = __(reward.name)
                              if (reward.category) { name = __('「') + name + __('」') }
                              const amount = reward.amount ? (` × ${reward.amount}`) : ''
                              const category = __(reward.category || '')
                              return (
                                <li key={`reward_other_${reward.name}`}>
                                  {category}{name}{amount}
                                </li>
                              )
                            })
                          }
                        </ul>
                      </Panel>
                      <Panel header={__('Note')} bsStyle="success">
                        <div>
                          <div>{__('Requirement')}:</div>
                          <div className="reqDetail">
                            <OverlayTrigger placement="left" overlay={<Tooltip id="questReqInfo">{questSelected.detail}</Tooltip>}>
                              <div className="tooltipTrigger">{questSelected.condition}</div>
                            </OverlayTrigger>
                          </div>
                          {(questSelected.prerequisite || []).length !== 0 &&
                            <div>
                              <div>{__('Requires')}:</div>
                              {
                                questSelected.prerequisite.map(qid =>
                                  (<div className="prereqName" key={qid}>
                                    {this.renderQuestLink(qid)}
                                  </div>)
                                )
                              }
                            </div>
                          }
                          {(questSelected.postquest || []).length !== 0 &&
                            <div>
                              <div>{__('Unlocks')}:</div>
                              {
                                questSelected.postquest.map(qid =>
                                  (<div className="prereqName" key={qid}>
                                    {this.renderQuestLink(qid)}
                                  </div>)
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
  '/kcsapi/api_get_member/questlist',
]

export { reducer, switchPluginPath }
