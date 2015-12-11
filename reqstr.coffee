fs = require 'fs-extra'
fs = require 'fs-extra'
sprintf = require("sprintf-js").sprintf
_ = require 'underscore'
_.mixin require 'underscore.inflection'

conditions = require './assets/quest.json'

__ = require './assets/etc-zh_CN.json'
#__ = Object.assign require('./assets/etc-en_US.json'), require('../fetchList/en-US.json')

# Create a function, that exactly runs as f, but allows the elements in the 
# first argument passed to f (which is an object) accessed by @arg_name
# Example: 
#   f = extract_first_arg (a, b) -> console.log @foo + b
#   f({foo: "bar"}, "baz")     # prints "barbaz"
extract_first_arg = (f) ->
  # This is the function stored as global functions
  (local_args) ->
    # This is the function created on each call
    new_f = ->
      f.apply Object.assign(this, local_args), arguments
    new_f.apply new_f, arguments

MAX_SHIP_AMOUNT = 6
MAX_SHIP_LV = 200       # Doesn't matter, usually we use 999. See usage below

# translate
_$ = (s) ->
  __[s] or s

reqstr_pluralize = (str, amount)->
  return str if !__['option_pluralize'] or !amount
  _.pluralize str, amount

reqstr_frequency = (times) ->
  return times if !__['option_frequency']
  switch times
    when 1 then 'once'
    when 2 then 'twice'
    else "#{times} times"

reqstr_ordinalize = (num) ->
  return num if !__['option_ordinalize']
  _.ordinalize num

reqstr_categories = []

reqstr_ship = (ship, amount) ->
  if typeof ship == "string"
    str_one = _$ ship
  else if Array.isArray ship
    str_one = (reqstr_ship(_s) for _s in ship).join '/'
  amount = if Array.isArray amount then amount[amount.length-1] else amount
  reqstr_pluralize str_one, amount

delim_join = (strs, delim, delim_last) ->
  if typeof delim_last == "undefined" || delim_last == null || strs.length <= 1
    strs.join delim
  else
    strs[...-1].join(delim) + delim_last + strs[strs.length-1]

reqstr_group = extract_first_arg (group) ->
  #     {
  #       "ship":  "晓" | ["空母", "轻母", "水母"],
  #       <"amount": 1 | [1, 3] | [3, 3] | [3, 6],>  # 6 == 'inf'
  #       <"flagship": true,>
  #       <"note": "轻母",>
  #       <"select": 5,>    # "any 5 of xxx/xxx ships"
  #       <"lv": 99 | [95, 99] | [100, 999],>   # 999 == 'inf'
  #     }, ...

  if @amount
    if Array.isArray @amount
      if @amount[0] == @amount[1]
        str_amount = sprintf __['format_group_amountonly'], "#{@amount[0]}"
      else if @amount[1] >= MAX_SHIP_AMOUNT
        str_amount = sprintf __['format_group_amountmore'], "#{@amount[0]}"
      else
        str_amount = sprintf __['format_group_amount'], "#{@amount[0]}~#{@amount[1]}"
    else
      str_amount = sprintf __['format_group_amount'], "#{@amount}"
  else
    str_amount = ''

  if @lv
    if Array.isArray @lv
      if @lv[1] >= MAX_SHIP_LV
        str_lv = sprintf __['format_group_lvmore'], "#{@lv[0]}"
      else
        str_lv = sprintf __['format_group_lv'], "#{@lv[0]}~#{@lv[1]}"
    else
      str_lv = sprintf __['format_group_lv'], "#{@lv}"
  else
    str_lv = ''

  str_select = if @select then sprintf __['format_group_select'], @select else ''
  str_ship = reqstr_ship @ship, @amount 
  str_flagship = if @flagship then __['format_group_flagship'] else ''
  str_note = if @note then sprintf __['format_group_note'], _$ @note else ''
  sprintf __['format_group'], 
    select: str_select,
    ship: str_ship,
    amount: str_amount,
    lv: str_lv,
    flagship: str_flagship,
    note: str_note

reqstr_groups = (groups) ->
  delim_join (reqstr_group(group) for group in groups), 
      __['format_groups_delim'], __['format_groups_delim_last']

reqstr_categories['fleet'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "fleet",
  #   "groups": [(group), ...],
  #   <"fleetid": 2,>
  #   <"disallowed": "其它舰船",>
  # }

  str_groups = reqstr_groups @groups
  str_disallowed = if @disallowed then sprintf __['format_fleet_disallowed'], reqstr_ship @disallowed, 2 else ''
  str_fleet = if @fleetid then sprintf __['format_fleet_fleetid'], reqstr_ordinalize @fleetid else ''
  sprintf __['format_fleet'], 
    groups: str_groups,
    disallowed: str_disallowed,
    fleet: str_fleet

reqstr_categories['sortie'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "sortie",
  #   "times": 2,
  #   <"map": 2,>
  #   <"result": "C",>
  #   <"not_boss": true,>   # boss is default
  #   <"groups": [(group), ...]>,
  #   <"fleetid": 2,>
  #   <"disallowed": "其它舰船" | "正规航母",>
  # }

  str_map = if @map then sprintf __['format_sortie_map'], @map else ''
  str_boss = if @boss then sprintf __['format_sortie_boss'] else ''
  str_result = if @result then sprintf __['format_sortie_result'], __['result_'+@result] else ''
  str_times = sprintf __['format_sortie_times'], reqstr_frequency @times
  str_groups = if @groups then sprintf __['format_sortie_groups'], reqstr_groups @groups else ''
  str_fleet = if @fleetid then sprintf __['format_sortie_fleet'], reqstr_ordinalize @fleetid else ''
  str_disallowed = if @disallowed then sprintf __['format_sortie_disallowed'], reqstr_ship @disallowed, 2 else ''
  sprintf __['format_sortie'],
    map: str_map,
    boss: str_boss,
    result: str_result,
    times: str_times,
    groups: str_groups,
    fleet: str_fleet
    disallowed: str_disallowed

reqstr_categories['sink'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "sink",
  #   "amount": 2,
  #   "ship": (ship),
  # }

  str_amount = sprintf __['format_sink_amount'], @amount
  str_ship = sprintf __['format_sink_ship'], reqstr_ship(@ship, @amount)
  sprintf __['format_sink'],
    amount: str_amount,
    ship: str_ship

reqstr_categories['expedition'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "expedition",
  #   <"id": 39 | [37, 38],>
  #   "times": 2,
  # }
  
  (for object in detail['objects']
    str_name = if object.id 
        str_id = if Array.isArray object.id then object.id.join '/' else object.id
        sprintf __['format_expedition_id'], str_id
      else 
        __['format_expedition_any']
    str_times = reqstr_frequency object.times
    sprintf __['format_expedition'],
      name: str_name,
      times: str_times).join __["format_expedition_delim"]

reqstr_categories['a_gou'] = ->
  __['format_a_gou']

reqstr_categories['simple'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "simple",
  #   "subcategory": "equipment" | "ship" | "scrapequipment" | "scrapship" |
  #                  "modernization" | "improvement" | "resupply" | "repair"
  #   "times": 2,
  #   <other subcategory-specified terms>
  # }
  # DEFINITION FORMAT: 
  #   format_simple_SUBCATEGORYNAME = "......%s.......%%(FOO)s.....%%(BAR)s"
  #     %s : "times"
  #     %%(FOO)s : Subcategory-specifed terms, must be double-"%"ed
  #   format_simple_SUBCATEGORYNAME_quantifier 
  #     [Optional] Used to be pluralized and inserted to %s
  #   format_simple_SUBCATEGORYNAME_FOO 
  #     Must be boolean
  # Example:
  #     "format_simple_scrapequipment": "Scrap equipment %s%%(batch)",
  #     "format_simple_scrapequipment_quantifier": "time",
  #     "format_simple_scrapequipment_note": " (scrapping together is ok)",
  #   "requirements": {
  #     "times": 5
  #     "batch": true
  #   }
  #   => "Scrap equipment 5 times (scrapping together is ok)"

  subcat = @subcategory
  basename = "format_simple_#{@subcategory}"
  quantifier = __["#{basename}_quantifier"] || ''
  if !quantifier
    str_times = @times
  else if quantifier == 'time'
    str_times = reqstr_frequency @times
  else
    str_times = @times + ' ' + reqstr_pluralize quantifier, @times
  extras = {}
  for extra_name, extra_value of detail
    extra_str = if extra_value then __["#{basename}_#{extra_name}"] || '' else ''
    extras[extra_name] = extra_str

  sprintf (sprintf __[basename], str_times), extras

reqstr_categories['excercise'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "excercise",
  #   "times": 2,
  #   <"victory": true,>
  #   <"daily": true,>
  # }
  quantifier = __['format_excercise_quantifier'] || ''
  if quantifier
    str_times = @times + ' ' + reqstr_pluralize quantifier, @times
  else
    str_times = @times
  str_victory = if @victory then __['format_excercise_victory'] else ''
  str_daily = if @daily then __['format_excercise_daily'] else ''
  sprintf __['format_excercise'], 
    times: str_times,
    victory: str_victory,
    daily: str_daily

reqstr = (requirements) ->
  try
    category = requirements['category']
    fn = reqstr_categories[category]
    console.log "+"+fn(requirements)
  catch e
    console.log "Invalid requirements: #{requirements} reason: #{e} #{e.stack}"
  
test_reqstr = ->
  for quest in conditions
    if quest['requirements']
      reqstr quest['requirements']
      console.log "-"+quest['condition']
    else
      console.log "***"+quest['condition']

test_reqstr()
