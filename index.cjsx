{join} = require "path-extra"
fs = require "fs-extra"
json = fs.readJsonSync join(__dirname, "assets", "quest.json")
quests = []
quests[quest.name] = quest for quest in json

categoryNames = ["", "编成", "出击", "演习", "远征", "补给/入渠", "工厂", "改装"]
typeNames = ["", "单次任务", "每日任务", "每周任务", "3/7/0日任务", "2/8日任务", "每月任务"]

window.addEventListener 'task.change', (e) ->
  {tasks} = e.detail
  for task in tasks when task.id isnt 100000
    if quests?[task.name]?
      quest = quests[task.name]
      task.content = <div>{categoryNames[quest.category]} - {typeNames[quest.type]}<br />{quest.condition}</div>
  event = new CustomEvent 'task.info',
    bubbles: true
    cancelable: true
    detail:
      tasks: tasks
  window.dispatchEvent event

module.exports =
  name: "quest"
  priority: 2
  displayName: [<FontAwesome key={0} name='indent' />, " 任务信息"]
  description: "任务面板显示完成条件"
  author: "马里酱"
  link: "https://github.com/malichan"
  version: '0.9.0'
  show: false
