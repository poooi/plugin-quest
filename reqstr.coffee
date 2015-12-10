fs = require 'fs-extra'
conditions = fs.readJsonSync './quest.json'

# Create a function, that exactly runs as f, but allows the elements in the 
# first argument passed to f (which is an object) accessed by @arg_name
# Example: 
#   f = localized (a, b) -> console.log @foo + b
#   f({foo: "bar"}, "baz")     # prints "barbaz"
localized = (f) ->
  # This is the function stored as global functions
  (local_args) ->
    # This is the function created on each call
    new_f = ->
      f.apply Object.assign(this, local_args), arguments
    new_f.apply new_f, arguments

reqstr_categories = []

reqstr_ship = (ship) ->
  if typeof ship == "string"
    ship
  else
    (reqstr_ship(_s) for _s in ship).join '/'

reqstr_group = localized (group) ->
  #     {
  #       "ship":  "晓" | ["空母", "轻母", "水母"],
  #       <"amount": 1 | [1, 3] | [3, 3],>
  #       <"flagship": true,>
  #       <"note": "轻母",>
  #     }, ...

  str = reqstr_ship(@ship)
  if @amount
    if Array.isArray(@amount)
      if @amount[0] == @amount[1]
        str += "仅#{@amount[0]}只"
      else
        str += "#{@amount[0]}~#{@amount[1]}只"
    else
      str += "#{@amount}只"
  str += '(旗舰)' if @flagship
  str += "(#{@note})#" if @note
  str

reqstr_categories['compfleet'] = localized (detail) ->
  # FORMAT:
  # "detail": {
  #   "groups": [(group), ...],
  #   <"fleetid": 2,>
  #   <"disallowed": "其它舰船",>
  # }

  str = '编组'
  str += (reqstr_group(group) for group in @groups).join('+')
  str += "，#{@disallowed}不可" if @disallowed
  str += "，限第#{@fleetid}舰队" if @fleetid
  str

reqstr_categories['attack_map'] = localized (detail) ->
  # FORMAT:
  # "detail": {
  #   "times": 2,
  #   <"map": 2,>
  #   <"result": "C",>
  #   <"not_boss": true,>   # boss is default
  #   <"groups": [(group), ...]>,
  #   <"fleetid": 2,>
  #   <"disallowed": "其它舰船" | "正规航母",>
  # }

  reqstr_result = (result) ->
    switch result
      when 'S' then 'S胜'
      when 'A' then 'A胜或以上'
      when 'B' then 'B胜或以上'
      when 'C' then 'C败或以上'

  if !@map
    str = if @result then '出击' else '进行战斗'
  else
    str = @map + ' '
    if !@not_boss
      str += 'Boss战'
  if @result
    str += reqstr_result @result
  str += "#{@times}次"
  str += '，需要'+(reqstr_group(group) for group in @groups).join('+') if @groups
  str += "，限第#{@fleetid}舰队" if @fleetid
  str += "#{@disallowed}不可" if @disallowed
  str


reqstr = (requirements) ->
  try
    category = requirements['category']
    fn = reqstr_categories[category]
    console.log "+"+fn(requirements['detail'])
  catch e
    console.log "Invalid requirements: #{requirements} reason: #{e}"
  
test_reqstr = ->
  for quest in conditions
    if quest['requirements']
      reqstr quest['requirements']
      console.log "-"+quest['condition']

test_reqstr()
