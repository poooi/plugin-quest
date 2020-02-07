import { join } from 'path-extra'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import {
  Grid,
  Row,
  Col,
  OverlayTrigger,
  Tooltip,
  Dropdown,
  MenuItem,
  Button,
  ButtonToolbar,
} from 'react-bootstrap'
import { sortBy, range, values, get } from 'lodash'
import { connect } from 'react-redux'
import FA from 'react-fontawesome'
import { shell } from 'electron'
import { extensionSelectorFactory } from 'views/utils/selectors'
import { MaterialIcon } from 'views/components/etc/icon'
import i18next from 'views/env-parts/i18next'
import { translate } from 'react-i18next'

import Panel from './compat-panel'
import { reducer, readQuestInfo } from './redux'

const EXTENSION_KEY = 'poi-plugin-quest-info'
const pluginDataSelector = extensionSelectorFactory(EXTENSION_KEY)

const NS = [EXTENSION_KEY, 'resources']

const { ipc } = window

const filterNames = [
  'Composition',
  'Sortie',
  'Exercise',
  'Expedition',
  'Supply/Docking',
  'Arsenal',
  'Modernization',
  'Marriage',
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
]

const categoryNames = [
  'Composition',
  'Sortie',
  'Exercise',
  'Expedition',
  'Supply/Docking',
  'Arsenal',
  'Modernization',
]

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
  'One-time',
  'Daily',
  'Weekly',
  '-3rd/-7th/-0th',
  '-2nd/-8th',
  'Monthly',
  'Quarterly',
]

const FilterItem = translate(NS)(({ t, index }) => (
  <span>
    {categoryColors[index] && (
      <span
        className="cat-indicator"
        style={{ backgroundColor: categoryColors[index] }}
      />
    )}
    {t(filterNames[index])}
  </span>
))

FilterItem.propTypes = {
  index: PropTypes.number.isRequired,
  t: PropTypes.func.isRequired,
}

const QuestItem = ({ quest = {} }) => (
  <span className="quest-item">
    <span
      className="cat-indicator"
      style={{ backgroundColor: categoryColors[quest.category - 1] }}
    />
    {quest.wiki_id} - {quest.name}
  </span>
)

QuestItem.propTypes = {
  quest: PropTypes.shape({
    category: PropTypes.number.isRequired,
  }).isRequired,
}

const RewardItem = translate(NS, { nsMode: 'fallback' })(({ t, reward }) => {
  let name = t(reward.name)
  if (reward.category) {
    name = t('「') + name + t('」')
  }
  const amount = reward.amount ? ` × ${reward.amount}` : ''
  const category = t(reward.category || '')
  return (
    <li>
      {category}
      {name}
      {amount}
    </li>
  )
})

RewardItem.propTypes = {
  reward: PropTypes.shape({
    name: PropTypes.string,
    amount: PropTypes.number,
    category: PropTypes.number,
  }).isRequired,
  t: PropTypes.func.isRequired,
}

// 'W' represents wedding/marriage

@translate(NS, { nsMode: 'fallback' })
@connect(pluginDataSelector, {
  readQuestInfo,
})
class PluginQuest extends Component {
  static initFilterFuncs = () => {
    const filterFuncs = {}
    range(0, 7).forEach(i => {
      filterFuncs[i] = quest =>
        quest.category === i + 1 && quest.wiki_id.charAt(0) !== 'W'
    })
    filterFuncs[7] = quest => quest.wiki_id.charAt(0) === 'W'
    filterFuncs[8] = quest => [2, 4, 5].includes(quest.type)
    filterFuncs[9] = quest => quest.type === 3
    filterFuncs[10] = quest => quest.type === 6
    filterFuncs[11] = quest => quest.type === 7
    return filterFuncs
  }

  static filterQuestByStatus(quests, questStatus, status) {
    return values(quests).filter(
      quest => quest && questStatus[quest.game_id] === status,
    )
  }

  static propTypes = {
    readQuestInfo: PropTypes.func.isRequired,
    quests: PropTypes.arrayOf(PropTypes.object).isRequired,
    questStatus: PropTypes.objectOf(PropTypes.object).isRequired,
    t: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props)
    this.filterFuncs = this.constructor.initFilterFuncs()
    this.state = {
      questFilter: 0,
      questId: 101,
    }
  }

  componentDidMount() {
    window.addEventListener('game.request', this.handleRequest)
    ipc.register('quest-info', {
      switchTo: this.handleSwitchTo,
    })

    const dataPath = window.config.get(
      'plugin.quest.path',
      join(__dirname, 'assets', 'data.json'),
    )
    const __ = i18next.getFixedT(window.language, NS)
    this.props.readQuestInfo(dataPath, __)
  }

  componentWillUnmount() {
    window.removeEventListener('game.request', this.handleRequest)
    ipc.unregister('quest-info')
  }

  getDefaultQuestId(questFilter = 0) {
    return get(
      sortBy(
        values(this.props.quests).filter(
          quest => quest && this.filterFuncs[questFilter](quest),
        ),
        'wiki_id',
      ),
      '0.game_id',
      0,
    )
  }

  handleSwitchTo = questId => {
    this.handlePrereqClick(questId)()
  }

  handleFileterSelect = eventKey => {
    const questFilter = parseInt(eventKey, 10)
    const questId = this.getDefaultQuestId(questFilter)
    this.setState({
      questId,
      questFilter,
    })
  }

  handleQuestSelect = eventKey => {
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

  handleRequest = e => {
    if (e.detail.path === '/kcsapi/api_req_quest/start') {
      const { api_quest_id: questId } = e.detail.body
      this.handlePrereqClick(+questId)()
    }
  }

  handleReport = () => {
    const { quests } = this.props
    const { questId } = this.state

    const quest = quests[questId]

    const title = quest
      ? `[Wrong Data] Quest ${quest.wiki_id} / ${questId}`
      : `[Wrong data] Quest ${questId}`

    shell.openExternal(
      `https://github.com/kcwikizh/kcdata/issues/new?title=${title}`,
    )
  }

  /* eslint-disable jsx-a11y/click-events-have-key-events,
  jsx-a11y/no-static-element-interactions,
  jsx-a11y/anchor-is-valid */
  renderQuestLink = qid => {
    const quest = this.props.quests[qid] || {}
    const { t } = this.props
    return (
      <OverlayTrigger
        placement="left"
        overlay={
          <Tooltip id={`quest-link-${qid}`}>
            <strong>{quest.name}</strong>
            <br />
            {t(categoryNames[quest.category - 1])}-
            {t(typeNames[quest.type - 1])}
            <br />
            {quest.condition}
          </Tooltip>
        }
      >
        <div className="tooltipTrigger">
          <a onClick={this.handlePrereqClick(qid)}>
            <QuestItem quest={quest} />
          </a>
        </div>
      </OverlayTrigger>
    )
  }

  static renderQuestOption(quest, activeQuestId) {
    return (
      <MenuItem
        key={quest.game_id}
        eventKey={quest.game_id}
        active={quest.game_id === activeQuestId}
      >
        <QuestItem quest={quest} />
      </MenuItem>
    )
  }

  render() {
    const { quests, questStatus, t } = this.props
    const { questId, questFilter } = this.state
    if (!quests || !questStatus) {
      return <div>Now Loading...</div>
    }
    const filterFunc = this.filterFuncs[questFilter] || (() => false)
    const questsFiltered = sortBy(
      values(quests).filter(quest => quest && filterFunc(quest)),
      [
        quest => (quest.wiki_id || '').replace(/\d/g, ''),
        quest => parseInt((quest.wiki_id || '').replace(/\D/g, ''), 10),
      ],
    )
    const questSelected = (questId ? quests[questId] : questsFiltered[0]) || {}

    return (
      <div id="quest-info" className="quest-info">
        <link rel="stylesheet" href={join(__dirname, 'assets', 'quest.css')} />
        <Grid>
          <Row>
            <Col xs={12}>
              <ButtonToolbar className="quest-select">
                <Dropdown
                  id="quest-type-filter"
                  onSelect={this.handleFileterSelect}
                >
                  <Dropdown.Toggle>
                    <FilterItem index={questFilter} />
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {filterNames.map((name, idx) => (
                      // Please keep '=== true' as normally it will return the string itself
                      <MenuItem
                        key={name}
                        eventKey={idx}
                        active={idx === questFilter}
                      >
                        <FilterItem index={idx} />
                      </MenuItem>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
                <Dropdown
                  pullRight
                  id="quest-name-select"
                  onSelect={this.handleQuestSelect}
                >
                  <Dropdown.Toggle>
                    <QuestItem quest={questSelected} />
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <MenuItem header>{t('Operable')}</MenuItem>
                    {this.constructor
                      .filterQuestByStatus(questsFiltered, questStatus, 2)
                      .map(quest =>
                        this.constructor.renderQuestOption(quest, questId),
                      )}
                    <MenuItem header>{t('Locked')}</MenuItem>
                    {this.constructor
                      .filterQuestByStatus(questsFiltered, questStatus, 3)
                      .map(quest =>
                        this.constructor.renderQuestOption(quest, questId),
                      )}
                    <MenuItem header>{t('Completed')}</MenuItem>
                    {this.constructor
                      .filterQuestByStatus(questsFiltered, questStatus, 1)
                      .map(quest =>
                        this.constructor.renderQuestOption(quest, questId),
                      )}
                  </Dropdown.Menu>
                </Dropdown>
              </ButtonToolbar>
            </Col>
          </Row>
          {questSelected && (
            <Row>
              <Col xs={12}>
                <Panel>
                  <div>
                    <div className="quest-title">
                      {questSelected.name ||
                        t('Undocumented quest, please wait for updates')}
                    </div>
                    <div className="quest-type">
                      {`${t(categoryNames[questSelected.category - 1])} - ${t(
                        typeNames[questSelected.type - 1],
                      )}`}
                    </div>
                  </div>
                  <Row>
                    <div className="quest-info">
                      <Panel header={t('Reward')} bsStyle="info">
                        <ul>
                          {[
                            'reward_fuel',
                            'reward_ammo',
                            'reward_steel',
                            'reward_bauxite',
                          ].some(name => questSelected[name] > 0) && (
                            <li>
                              {[
                                'reward_fuel',
                                'reward_ammo',
                                'reward_steel',
                                'reward_bauxite',
                              ].map(
                                (name, i) =>
                                  questSelected[name] > 0 && (
                                    <span
                                      key={name}
                                      style={{ marginRight: '1em' }}
                                    >
                                      <MaterialIcon
                                        materialId={i + 1}
                                        className="material-icon"
                                      />{' '}
                                      {questSelected[name]}
                                    </span>
                                  ),
                              )}
                            </li>
                          )}
                          {(questSelected.reward_other || []).map(reward => {
                            if (reward.choices) {
                              return (
                                <li
                                  key={`reward_other_${JSON.stringify(
                                    reward.choices,
                                  )}`}
                                >
                                  {t('multiple_choices', {
                                    amount: reward.choices.length,
                                  })}
                                  <ul>
                                    {reward.choices.map(choice => (
                                      <RewardItem
                                        reward={choice}
                                        key={choice.name}
                                      />
                                    ))}
                                  </ul>
                                </li>
                              )
                            }
                            return (
                              <RewardItem
                                reward={reward}
                                key={`reward_other_${reward.name}`}
                              />
                            )
                          })}
                        </ul>
                      </Panel>
                      <Panel header={t('Note')} bsStyle="success">
                        <div>
                          <div>{t('Requirement')}:</div>
                          <div className="reqDetail">
                            <OverlayTrigger
                              placement="left"
                              overlay={
                                <Tooltip id="questReqInfo">
                                  {questSelected.detail}
                                </Tooltip>
                              }
                            >
                              <div className="tooltipTrigger">
                                {questSelected.condition}
                              </div>
                            </OverlayTrigger>
                          </div>
                          {(questSelected.prerequisite || []).length !== 0 && (
                            <div>
                              <div>{t('Requires')}:</div>
                              {questSelected.prerequisite.map(qid => (
                                <div className="prereqName" key={qid}>
                                  {this.renderQuestLink(qid)}
                                </div>
                              ))}
                            </div>
                          )}
                          {(questSelected.postquest || []).length !== 0 && (
                            <div>
                              <div>{t('Unlocks')}:</div>
                              {questSelected.postquest.map(qid => (
                                <div className="prereqName" key={qid}>
                                  {this.renderQuestLink(qid)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Panel>
                    </div>
                  </Row>
                </Panel>
                <div className="report">
                  <Button bsStyle="link" onClick={this.handleReport}>
                    <FA name="exclamation-circle" />{' '}
                    {t('The info for this quest is incorrect, report it')}
                  </Button>
                </div>
              </Col>
            </Row>
          )}
        </Grid>
      </div>
    )
  }
}

export const reactClass = PluginQuest
export { reducer }
