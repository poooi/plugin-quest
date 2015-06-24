{join} = require "path-extra"
{_, $, $$, React, ReactBootstrap, FontAwesome, layout} = window
{Grid, Row, Col, Input, Panel} = ReactBootstrap

categoryNames = ["空", "编成", "出击", "演习", "远征", "补给/入渠", "工厂", "改装"]
typeNames = ["空", "单次任务", "每日任务", "每周任务", "3/7/0日任务", "2/8日任务", "每月任务"]

module.exports =
  name: "quest-info"
  priority: 2
  displayName: [<FontAwesome key={0} name='indent' />, " 任务信息"]
  description: "任务信息查询 & 任务面板强化"
  author: "马里酱"
  link: "https://github.com/malichan"
  version: "1.0.0"
  reactClass: React.createClass
    getInitialState: ->
      fs = require "fs-extra"
      json = fs.readJsonSync join(__dirname, "assets", "quest.json")
      quests = []
      quests[quest.game_id] = quest for quest in json
      {
        quests: quests
        quest_category: 0
        quest_id: 0
        quests_in_category: []
        quest_selected: null
      }
    handleTaskChange: (e) ->
      {tasks} = e.detail
      for task in tasks when task.id isnt 100000
        if @state.quests[task.id]?
          quest = @state.quests[task.id]
          task.content = <div>{categoryNames[quest.category]} - {typeNames[quest.type]}<br />{quest.condition}</div>
      event = new CustomEvent 'task.info',
        bubbles: true
        cancelable: true
        detail:
          tasks: tasks
      window.dispatchEvent event
    handleCategoryChange: (cid) ->
      quest_category = cid
      quests_in_category = (quest for quest in @state.quests when quest? and quest.category is quest_category)
      quests_in_category = _.sortBy quests_in_category, (e) ->
        e.wiki_id
      @setState
        quest_category: quest_category
        quests_in_category: quests_in_category
    handleQuestChange: (qid) ->
      quest_id = qid
      quest_selected = @state.quests[quest_id]
      @setState
        quest_id: quest_id
        quest_selected: quest_selected
    handleCategorySelect: (e) ->
      quest_category = parseInt e.target.value
      @handleCategoryChange quest_category
      @setState
        quest_id: 0
        quest_selected: null
    handleQuestSelect: (e) ->
      quest_id = parseInt e.target.value
      @handleQuestChange quest_id
    handlePrereqClick: (qid) ->
      quest_category = @state.quests[qid].category
      quest_id = qid
      @handleCategoryChange quest_category
      @handleQuestChange quest_id
    componentDidMount: ->
      window.addEventListener "task.change", @handleTaskChange
    render: ->
      <div>
        <link rel='stylesheet' href={join(__dirname, "assets", "quest.css")} />
        <Grid>
          <Row>
            <Col xs=12>
              <Panel header='任务选择' bsStyle='primary'>
                <Input type='select' label='任务种类' value={@state.quest_category} onChange={@handleCategorySelect}>
                  {
                    for category, idx in categoryNames
                      <option key={idx} value={idx}>{category}</option>
                  }
                </Input>
                <Input type='select' label='任务名称' value={@state.quest_id} onChange={@handleQuestSelect}>
                  <option key={0}>空</option>
                  {
                    for quest in @state.quests_in_category
                      <option key={quest.game_id} value={quest.game_id}>{quest.wiki_id} - {quest.name}</option>
                  }
                </Input>
              </Panel>
            </Col>
          </Row>
          <Row>
            <Col xs=12>
              <Panel header='任务详情' bsStyle='danger'>
                {
                  if @state.quest_selected?
                    <div>
                      <h4>{@state.quest_selected.name}</h4>
                      <h6>{categoryNames[@state.quest_selected.category]} - {typeNames[@state.quest_selected.type]}</h6>
                    </div>
                  else
                    <div>
                      <h4>请选择任务</h4>
                      <h6>未知类型</h6>
                    </div>
                }
                <Row>
                  <table width='100%' className='questInfo'>
                    <tbody>
                      <tr>
                        <td>
                          <Panel header='任务奖励' bsStyle='info'>
                            {
                              if @state.quest_selected?
                                <ul>
                                  <li key='reward_fuel'>获得燃料 {@state.quest_selected.reward_fuel}</li>
                                  <li key='reward_bullet'>获得弹药 {@state.quest_selected.reward_bullet}</li>
                                  <li key='reward_steel'>获得钢材 {@state.quest_selected.reward_steel}</li>
                                  <li key='reward_alum'>获得铝土 {@state.quest_selected.reward_alum}</li>
                                  <li key='reward_other'>{@state.quest_selected.reward_other}</li>
                                </ul>
                            }
                          </Panel>
                        </td>
                        <td>
                          <Panel header='必要条件' bsStyle='success'>
                            {
                              if @state.quest_selected?
                                <div>
                                  <p>完成条件:</p>
                                  <p className='reqDetail'>{@state.quest_selected.condition}</p>
                                  <p>前置任务:</p>
                                  {
                                    if @state.quest_selected.prerequisite.length > 0
                                      for qid in @state.quest_selected.prerequisite
                                        <p className='prereqName'><a onClick={@handlePrereqClick.bind this, qid}>{@state.quests[qid].wiki_id} - {@state.quests[qid].name}</a></p>
                                    else
                                      <p className='prereqName'>无</p>
                                  }
                                </div>
                            }
                          </Panel>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Row>
              </Panel>
            </Col>
          </Row>
        </Grid>
      </div>