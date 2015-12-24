{join} = require 'path-extra'
{_, $, $$, React, ReactBootstrap, FontAwesome, layout} = window
{Grid, Row, Col, Input, Panel, OverlayTrigger, Tooltip} = ReactBootstrap
_ = require 'underscore'
inflection = require 'inflection'

window.i18n.questInfo = new(require 'i18n-2')
  locales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW']
  defaultLocale: 'zh-CN'
  directory: join(__dirname, 'assets', 'i18n')
  devMode: false
  extension: '.json'
window.i18n.questInfo.setLocale(window.language)
i18n__ = window.i18n.questInfo.__.bind(window.i18n.questInfo)
i18n__n = window.i18n.questInfo.__n.bind(i18n.others)

__ = (s) ->
  tr = i18n__.apply this, arguments
  if tr == s
    tr = window.i18n.resources.__.apply this, arguments
  tr

reqstr = require('./reqstr')(__)

filterNames = [
  __('Quest Type'),
  __('Composition Quest'),
  __('Sortie Quest'),
  __('Exercise Quest'),
  __('Expedition Quest'),
  __('Supply/Docking Quest'),
  __('Arsenal Quest'),
  __('Modernization Quest'),
  __('Marriage Quest'),
  __('Daily Quest'),
  __('Weekly Quest'),
  __('Monthly Quest')
]
categoryNames = [
  '',
  __('Composition'),
  __('Sortie'),
  __('Exercise'),
  __('Expedition'),
  __('Supply/Docking'),
  __('Arsenal'),
  __('Modernization')
]
typeNames = [
  '',
  __('One-time Quest'),
  __('Daily Quest'),
  __('Weekly Quest'),
  __('-3rd/-7th/-0th'),
  __('-2nd/-8th'),
  __('Monthly Quest')
]
typeFreqs = [0, 1, 5, 3, 4, 4, 2]

module.exports =
  name: 'quest-info'
  priority: 2
  displayName: <span><FontAwesome key={0} name='indent' /> {__('Quest Information')}</span>
  description: __ 'Plugin Description'
  author: '马里酱'
  link: 'https://github.com/malichan'
  version: '2.0.3-beta'
  reactClass: React.createClass
    getInitialState: ->
      fs = require 'fs-extra'
      json = fs.readJsonSync join(__dirname, 'assets', 'quest.json')
      quests = []
      for quest in json
        quest.condition = reqstr quest['requirements']
        quests[quest.game_id] = quest
      quests_status = []
      for quest in json
        quest.postquest = []
        quests_status[quest.game_id] = 1
      for quest in json
        for pid in quest.prerequisite
          prereq = quests[pid]
          prereq.postquest.push quest.game_id
      {
        quests: quests
        quests_status: quests_status
        quest_filter: 0
        quest_id: 0
        quests_filtered: []
        quest_selected: null
      }
    handleTaskChange: (e) ->
      {tasks} = e.detail
      for task in tasks when task.id < 100000
        if @state.quests[task.id]?
          quest = @state.quests[task.id]
          task.content = <div>{categoryNames[quest.category]} - {typeNames[quest.type]}<br />{quest.condition}</div>
        else if typeof task.content isnt 'object'
          task.content = <div>{__('Quests')}ID: {task.id}<br />{task.content}</div>
      event = new CustomEvent 'task.info',
        bubbles: true
        cancelable: true
        detail:
          tasks: tasks
      window.dispatchEvent event
    handleFilterChange: (fid) ->
      quest_filter = fid
      quests_filtered = switch quest_filter
        when 0
          []
        when 1, 2, 3, 4, 5, 6, 7
          (quest for quest in @state.quests when quest? and quest.category is quest_filter and quest.wiki_id.charAt(0) isnt 'W')
        when 8
          (quest for quest in @state.quests when quest? and quest.wiki_id.charAt(0) is 'W')
        when 9
          (quest for quest in @state.quests when quest? and quest.type in [2, 4, 5])
        when 10
          (quest for quest in @state.quests when quest? and quest.type is 3)
        when 11
          (quest for quest in @state.quests when quest? and quest.type is 6)
      quests_filtered = _.sortBy quests_filtered, (e) ->
        e.wiki_id
      @setState
        quest_filter: quest_filter
        quests_filtered: quests_filtered
    handleQuestChange: (qid) ->
      quest_id = qid
      quest_selected = @state.quests[quest_id]
      @setState
        quest_id: quest_id
        quest_selected: quest_selected
    handleFilterSelect: (e) ->
      quest_filter = parseInt e.target.value
      @handleFilterChange quest_filter
      @setState
        quest_id: 0
        quest_selected: null
    handleQuestSelect: (e) ->
      quest_id = parseInt e.target.value
      @handleQuestChange quest_id
      # for test
      # {quests_status} = @state
      # @updateQuestStatus quest_id, quests_status
      # @setState
      #   quests_status: quests_status
    handlePrereqClick: (qid) ->
      quest = @state.quests[qid]
      quest_filter = switch
        when quest.type in [2, 4, 5] then 9
        when quest.type is 3 then 10
        when quest.type is 6 then 11
        when quest.wiki_id.charAt(0) is 'W' then 8
        else quest.category
      quest_id = qid
      @handleFilterChange quest_filter
      @handleQuestChange quest_id
    updateQuestStatus: (qid, status) ->
      quest = @state.quests[qid]
      return unless quest?
      for pid in quest.postquest
        postq = @state.quests[pid]
        if typeFreqs[quest.type] <= typeFreqs[postq.type] and status[postq.game_id] isnt 3
          status[postq.game_id] = 3
          @updateQuestStatus postq.game_id, status
    handleResponse: (e) ->
      {method, path, body, postBody} = e.detail
      {quests_status} = @state
      switch path
        when '/kcsapi/api_get_member/questlist'
          if body.api_list?
            for quest in body.api_list
              continue if quest is -1
              if quests_status[quest.api_no] isnt 2
                quests_status[quest.api_no] = 2
                @updateQuestStatus quest.api_no, quests_status
        when '/kcsapi/api_req_quest/clearitemget'
          qid = parseInt postBody.api_quest_id
          quests_status[qid] = 1
          for postq in @state.quests[qid].postquest when quests_status[postq] is 3
            quests_status[postq] = 2
      @setState
        quests_status: quests_status
    componentDidMount: ->
      window.addEventListener 'task.change', @handleTaskChange
      window.addEventListener 'game.response', @handleResponse
    render: ->
      <div>
        <link rel='stylesheet' href={join(__dirname, 'assets', 'quest.css')} />
        <Grid>
          <Row>
            <Col xs=12>
              <Panel header={__ 'Select Quest'} bsStyle='primary'>
                <Input type='select' label={__ 'Quest Type'} value={@state.quest_filter} onChange={@handleFilterSelect}>
                  {
                    for filter, idx in filterNames
                      filter = inflection.pluralize filter if __("req.option.pluralize") == true and idx != 0
                      <option key={idx} value={idx}>{filter}</option>
                  }
                </Input>
                <Input type='select' label={__ 'Quest Name'} value={@state.quest_id} onChange={@handleQuestSelect}>
                  <option key={0}>{__ 'Quest Name'}</option>
                  <optgroup label={__ 'Operable'}>
                  {
                    for quest in @state.quests_filtered when @state.quests_status[quest.game_id] is 2
                      <option key={quest.game_id} value={quest.game_id}>{quest.wiki_id} - {quest.name}</option>
                  }
                  </optgroup>
                  <optgroup label={__ 'Locked'}>
                  {
                    for quest in @state.quests_filtered when @state.quests_status[quest.game_id] is 3
                      <option key={quest.game_id} value={quest.game_id}>{quest.wiki_id} - {quest.name}</option>
                  }
                  </optgroup>
                  <optgroup label={__ 'Completed'}>
                  {
                    for quest in @state.quests_filtered when @state.quests_status[quest.game_id] is 1
                      <option key={quest.game_id} value={quest.game_id}>{quest.wiki_id} - {quest.name}</option>
                  }
                  </optgroup>
                </Input>
              </Panel>
            </Col>
          </Row>
          <Row>
            <Col xs=12>
              <Panel header={__ 'Quest Information'} bsStyle='danger'>
                {
                  if @state.quest_selected?
                    <div>
                      <div className='questTitle'>{@state.quest_selected.name}</div>
                      <div className='questType'>
                        {categoryNames[@state.quest_selected.category]} - {typeNames[@state.quest_selected.type]}
                      </div>
                    </div>
                  else
                    <div>
                    </div>
                }
                <Row>
                  <div className='questInfo'>
                    <Panel header={__ 'Reward'} bsStyle='info'>
                    {
                      if @state.quest_selected?
                        <ul>
                          <li key='reward_fuel'>{__ 'Fuel'} {@state.quest_selected.reward_fuel}</li>
                          <li key='reward_bullet'>{__ 'Ammo'} {@state.quest_selected.reward_ammo}</li>
                          <li key='reward_steel'>{__ 'Steel'} {@state.quest_selected.reward_steel}</li>
                          <li key='reward_alum'>{__ 'Bauxite'} {@state.quest_selected.reward_bauxite}</li>
                          {
                            for reward, i in @state.quest_selected.reward_other
                              name = __(reward.name)
                              name = __('「') + name + __('」') if reward.category?
                              amount = if reward.amount? then '×' + reward.amount else ''
                              category = __(reward.category || '')
                              <li key={"reward_other_#{i}"}>
                                {category}{name}{amount}
                              </li>
                          }
                        </ul>
                    }
                    </Panel>
                    <Panel header={__ 'Note'} bsStyle='success'>
                    {
                      if @state.quest_selected?
                        <div>
                          <div>{__ 'Requirement'}:</div>
                          <div className='reqDetail'>
                            <OverlayTrigger placement='left' overlay={<Tooltip id='questReqInfo'>{@state.quest_selected.detail}</Tooltip>}>
                              <div className='tooltipTrigger'>{@state.quest_selected.condition}</div>
                            </OverlayTrigger>
                          </div>
                          {
                            if @state.quest_selected.prerequisite.length > 0
                              <div>{__ 'Requires'}:</div>
                          }
                          {
                            if @state.quest_selected.prerequisite.length > 0
                              for qid, rqidx in @state.quest_selected.prerequisite
                                <div className='prereqName' key={rqidx}>
                                  <OverlayTrigger placement='left' overlay={
                                    <Tooltip id='preQuestInfo'>
                                      <strong>{@state.quests[qid].name}</strong><br />
                                      {categoryNames[@state.quests[qid].category]}-{typeNames[@state.quests[qid].type]}<br />
                                      {@state.quests[qid].condition}
                                    </Tooltip>}>
                                    <div className='tooltipTrigger'>
                                      <a onClick={@handlePrereqClick.bind this, qid}>
                                        {@state.quests[qid].wiki_id} - {@state.quests[qid].name}
                                      </a>
                                    </div>
                                  </OverlayTrigger>
                                </div>
                          }
                          {
                            if @state.quest_selected.postquest.length > 0
                              <div>{__ 'Unlocks'}:</div>
                          }
                          {
                            if @state.quest_selected.postquest.length > 0
                              for qid, uqidx in @state.quest_selected.postquest
                                <div className='prereqName' key={uqidx}>
                                  <OverlayTrigger placement='left' overlay={
                                    <Tooltip id='postQuestInfo'>
                                      <strong>{@state.quests[qid].name}</strong><br />
                                      {categoryNames[@state.quests[qid].category]}-{typeNames[@state.quests[qid].type]}<br />
                                      {@state.quests[qid].condition}
                                    </Tooltip>}>
                                    <div className='tooltipTrigger'>
                                      <a onClick={@handlePrereqClick.bind this, qid}>
                                        {@state.quests[qid].wiki_id} - {@state.quests[qid].name}
                                      </a>
                                    </div>
                                  </OverlayTrigger>
                                </div>
                          }
                        </div>
                    }
                    </Panel>
                  </div>
                </Row>
              </Panel>
            </Col>
          </Row>
        </Grid>
      </div>
