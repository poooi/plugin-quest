import { PromiseAction } from 'views/middlewares/promiseAction'
import { promisify } from 'bluebird'
import { readJson } from 'fs-extra'
import { forEach, range, get } from 'lodash'

import generateReqstr from './reqstr'
const { copyIfSame } = window

const initState = {
  quests: {},
  quests_status: {},
}

/* quests_status
 */
const [COMPLETED, AVAILABLE, UNAVAILABLE] = range(1, 4)


const typeFreqs = [0, 1, 5, 3, 4, 4, 2]

// Will modify `status`
function updateQuestStatus(quests, qid, status) {
  const quest = quests[qid]
  if (!quest)
    return
  quest.postquest.forEach((pid) => {
    const postq = quests[pid]
    if (!postq)
      return
    if (typeFreqs[quest.type] <= typeFreqs[postq.type] && status[postq.game_id] !== UNAVAILABLE) {
      status[postq.game_id] = UNAVAILABLE
      updateQuestStatus(quests, postq.game_id, status)
    }
  })
}

export default function reducer(state=initState, action) {
  const {type, body, postBody} = action
  switch(type) {
  case '@@poi-plugin-quest-info@init': {
    const reqstr = generateReqstr(action.__)
    const quests = window.indexify(require(action.path), 'game_id')
    const quests_status = {}
    forEach(quests, (quest) => {
      // Initialize `quests`
      quest.postquest = quest.postquest || []
      quest.condition = reqstr(quest['requirements'])
      if (typeof(quest.game_id) !== 'number') {
        console.warn(`Unexpected quest game_id type \"${typeof(quest.game_id)}\" for quest \"${quest.wiki_id}\"`)
        quest.game_id = `_UNKNOWN-${quests.length}`
      }
      quest.prerequisite.forEach((pid) => {
        if (typeof(pid) != 'number') {
          console.warn(`Unexpected quest prerequisite type \"${typeof(pid)}\" for quest \"${quest.wiki_id}\". Skipping.`)
          return
        }
        const prereq = quests[pid]
        if (!prereq) {
          console.warn(`Prereq ${pid} defined by quest ${quest.game_id} does not exist.`)
          return
        }
        prereq.postquest = prereq.postquest || []
        prereq.postquest.push(quest.game_id)
      })
      // Initialize `quests_status`
      quests_status[quest.game_id] = COMPLETED
    })
    return {
      ...state,
      quests,
      quests_status,
    }
  }

  case '@@Response/kcsapi/api_get_member/questlist': {
    let quests_status = state.quests_status
    const quests = state.quests
    const statusBackup = quests_status
    ;(body.api_list || []).forEach((quest) => {
      // `quest` may be -1
      if (!quest || typeof quest !== 'object')
        return
      if (state.quests_status[quest.api_no] !== AVAILABLE) {
        quests_status = copyIfSame(quests_status, statusBackup)
        quests_status[quest.api_no] = AVAILABLE
        updateQuestStatus(quests, quest.api_no, quests_status)
      }
    })
    if (quests_status !== statusBackup) {
      return {
        ...state,
        quests_status,
      }
    }
    break
  }

  case '@@Response/kcsapi/api_req_quest/clearitemget': {
    const qid = parseInt(postBody.api_quest_id)
    const quests = state.quests
    const quests_status = {...state.quests_status}
    quests_status[qid] = 1
    get(quests, [qid, 'postquest'], []).forEach((postq) => {
      if (quests_status[postq] !== UNAVAILABLE)
        return
      const clearflag = get(quests, [postq, 'prerequisite'], []).every((prereq) =>
        quests_status[prereq] === COMPLETED
      )
      if (clearflag)
        quests_status[postq] = AVAILABLE
    })
    return {
      ...state,
      quests_status,
    }
  }
  }
  return state
}

export function readQuestInfo(path, __) {
  return {
    type: '@@poi-plugin-quest-info@init',
    __,
    path,
  }
}
