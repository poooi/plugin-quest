inflection = require 'inflection'
Mustache = require 'mustache'

i18n_module = null

__ = (s) ->
  # This part copied from https://github.com/mashpie/i18n-node with MIT license
  # if the msg string contains {{Mustache}} patterns we render it as a mini tempalate
  tr = i18n_module.apply this, arguments
  if (/{{.*}}/).test tr
    tr = Mustache.render tr, arguments[arguments.length-1]
  tr

# Translate: Returns null if not exist. Used for format controller
_$ = (s) ->
  tr = __.apply this, arguments
  splits = s.split '.'
  if tr == splits[splits.length-1] then null else tr

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

reqstr_pluralize = (str, amount)->
  return str if !_$('req.option.pluralize') or !amount
  inflection.inflect str, amount

reqstr_frequency = (times) ->
  return times if !_$('req.option.frequency')
  switch times
    when 1 then 'once'
    when 2 then 'twice'
    else "#{times} times"

reqstr_ordinalize = (num) ->
  return num if !_$('req.option.ordinalize')
  inflection.ordinalize "#{num}"

reqstr_ship = (ship, amount) ->
  if typeof ship == "string"
    str_one = __ ship
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

  str_amount = 
  if @amount
    if Array.isArray @amount
      if @amount[0] == @amount[1]
        _$ 'req.group.amountonly', "#{@amount[0]}"
      else if @amount[1] >= MAX_SHIP_AMOUNT
        _$ 'req.group.amountmore', "#{@amount[0]}"
      else
        _$ 'req.group.amount', "#{@amount[0]}~#{@amount[1]}"
    else
      _$ 'req.group.amount', "#{@amount}"
  else
    ''

  if @lv
    if Array.isArray @lv
      if @lv[1] >= MAX_SHIP_LV
        str_lv = _$ 'req.group.lvmore', "#{@lv[0]}"
      else
        str_lv = _$ 'req.group.lv', "#{@lv[0]}~#{@lv[1]}"
    else
      str_lv = _$ 'req.group.lv', "#{@lv}"
  else
    str_lv = ''

  str_select = if @select then _$ 'req.group.select', @select else ''
  str_ship = reqstr_ship @ship, @amount
  str_flagship = if @flagship then _$ 'req.group.flagship' else ''
  str_note = if @note then _$ 'req.group.note', reqstr_ship @note else ''
  _$ 'req.group.main',
    select: str_select,
    ship: str_ship,
    amount: str_amount,
    lv: str_lv,
    flagship: str_flagship,
    note: str_note

reqstr_groups = (groups) ->
  delim_join (reqstr_group(group) for group in groups),
      _$('req.groups.delim'), _$('req.groups.delim_last')

reqstr_categories = []

reqstr_categories['fleet'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "fleet",
  #   "groups": [(group), ...],
  #   <"fleetid": 2,>
  #   <"disallowed": "其它舰船",>
  # }

  str_groups = reqstr_groups @groups
  str_disallowed = if @disallowed then _$ 'req.fleet.disallowed', reqstr_ship @disallowed, 2 else ''
  str_fleet = if @fleetid then _$ 'req.fleet.fleetid', reqstr_ordinalize @fleetid else ''
  _$ 'req.fleet.main',
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
  #   <"boss": true,>
  #   <"groups": [(group), ...]>,
  #   <"fleetid": 2,>
  #   <"disallowed": "其它舰船" | "正规航母",>
  # }

  str_boss = if @boss
      _$('req.sortie.boss') || ''
    else
      _$('req.sortie.!boss') || ''
  str_map = if @map then _$ 'req.sortie.map', {map: @map, boss: str_boss} else ''
  str_result = if @result
      _$ 'req.sortie.result', _$('req.result.'+@result)
    else
      _$('req.sortie.!result') || ''
  str_times = _$ 'req.sortie.times', reqstr_frequency @times
  str_groups = if @groups then _$ 'req.sortie.groups', reqstr_groups @groups else ''
  str_fleet = if @fleetid then _$ 'req.sortie.fleet', reqstr_ordinalize @fleetid else ''
  str_disallowed = if @disallowed then _$ 'req.sortie.disallowed', reqstr_ship @disallowed, 2 else ''
  _$ 'req.sortie.main',
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

  str_amount = _$ 'req.sink.amount', @amount
  str_ship = _$ 'req.sink.ship', reqstr_ship(@ship, @amount)
  _$ 'req.sink.main',
    amount: str_amount,
    ship: str_ship

reqstr_categories['expedition'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "expedition",
  #   <"id": 39 | [37, 38],>
  #   "times": 2,
  # }

  _$ 'req.expedition.main',
  (for object in detail['objects']
    str_name = if object.id
        str_id = if Array.isArray object.id then object.id.join '/' else object.id
        _$ 'req.expedition.id', str_id
      else
        _$('req.expedition.any')
    str_times = reqstr_frequency object.times
    _$ 'req.expedition.object',
      name: str_name,
      times: str_times).join _$ 'req.expedition.delim'

reqstr_categories['a-gou'] = ->
  _$ 'req.a-gou'

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
  #   req.simple.SUBCATEGORYNAME = "......%s.......{{{FOO}}}.....{{{BAR}}}"
  #     %s : "times"
  #     {{{FOO}}} : Subcategory-specifed terms
  #   req.simple.SUBCATEGORYNAME_quantifier
  #     [Optional] Used to be pluralized and inserted to %s
  #   req.simple.SUBCATEGORYNAME_FOO
  #     [Optional] Used in place of {{{FOO}}} when FOO=true
  #   req.simple.SUBCATEGORYNAME_!FOO
  #     [Optional] Used in place of {{{FOO}}} when FOO=false
  # Example:
  #     "req.simple.scrapequipment": "Scrap equipment %s{{{batch}}}",
  #     "req.simple.scrapequipment_quantifier": "time",
  #     "req.simple.scrapequipment_batch": " (scrapping together is ok)",
  #   "requirements": {
  #     "category": "simple",
  #     "subcategory": "scrapequipment",
  #     "times": 5,
  #     "batch": true       # Must be present even if false
  #   }
  #   => "Scrap equipment 5 times (scrapping together is ok)"

  subcat = @subcategory
  basename = "req.simple.#{@subcategory}"
  quantifier = _$("#{basename}_quantifier") || ''
  if !quantifier
    str_times = @times
  else if quantifier == 'time'
    str_times = reqstr_frequency @times
  else
    str_times = @times + ' ' + reqstr_pluralize quantifier, @times
  extras = {}
  for extra_name, extra_value of detail
    extra_str = if extra_value
        _$("#{basename}_#{extra_name}") || ''
      else
        _$("#{basename}_!#{extra_name}") || ''
    extras[extra_name] = extra_str

  _$ "#{basename}", str_times, extras

reqstr_categories['excercise'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "excercise",
  #   "times": 2,
  #   <"victory": true,>
  #   <"daily": true,>
  # }
  quantifier = _$('req.excercise.quantifier') || ''
  if quantifier
    str_times = @times + ' ' + reqstr_pluralize quantifier, @times
  else
    str_times = @times
  str_victory = if @victory then _$('req.excercise.victory') else ''
  str_daily = if @daily then _$('req.excercise.daily') else ''
  _$ 'req.excercise.main',
    times: str_times,
    victory: str_victory,
    daily: str_daily

reqstr_categories['modelconversion'] = extract_first_arg (detail) ->
  # FORMAT:
  # "requirements": {
  #   "category": "modelconversion",
  #   <"equipment": "零式艦戦21型(熟練)">,
  #   <"fullyskilled": true,>
  #   "scraps": [
  #     {"name": "零式艦戦52型", "amount": 2}
  #   ],
  #   <"secretary": (ship),>    # Default: "a carrier"
  #   <"use_skilled_crew": true>
  # }
  str_secretary = if @secretary then reqstr_ship @secretary else _$('req.modelconversion.secretarydefault')
  str_secretary_equip = if @equipment
      str_fullyskilled = if @fullyskilled then _$('req.modelconversion.fullyskilled') else ''
      _$ 'req.modelconversion.equip',
        secretary: str_secretary,
        equipment: __(@equipment),
        fullyskilled: str_fullyskilled
    else
      _$ 'req.modelconversion.noequip',
        secretary: str_secretary,
  str_scraps = (for scrap in @scraps
    _$ 'req.modelconversion.scrap',
      name: __(scrap['name']),
      amount: scrap['amount']).join _$('req.modelconversion.scrapdelim')
  str_note = if @use_skilled_crew then _$('req.modelconversion.useskilledcrew') else ''
  _$ 'req.modelconversion.main',
    secretary_equip: str_secretary_equip,
    scraps: str_scraps,
    note: str_note

reqstr = (requirements) ->
  try
    category = requirements['category']
    fn = reqstr_categories[category]
    ret = fn(requirements)
    #onsole.log ret
    ret
  catch e
    console.log "Invalid requirements: #{requirements} reason: #{e} #{e.stack}"

module.exports = (i18n_module_) ->
  i18n_module = i18n_module_
  reqstr
