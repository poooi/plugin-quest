{join} = require "path-extra"

categoryNames = ["", "编成", "出击", "演习", "远征", "补给/入渠", "工厂", "改装"]
typeNames = ["", "单次任务", "每日任务", "每周任务", "3/7/0日任务", "2/8日任务", "每月任务"]

module.exports =
  name: "quest-info"
  priority: 2
  displayName: [<FontAwesome key={0} name='indent' />, " 任务信息"]
  description: "任务信息查询 & 任务面板显示任务完成条件"
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
        quest_id: 0
        quests: quests
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
    componentDidMount: ->
      window.addEventListener "task.change", @handleTaskChange
    render: ->
      <div>
        <link rel='stylesheet' href={join(__dirname, "assets", "quest.css")} />
      </div>