import { forEach, range, get, keyBy } from 'lodash'

import generateReqstr from './reqstr'

const { copyIfSame } = window

const initState = {
  quests: {},
  questStatus: {},
}

/* questStatus
 */
const [COMPLETED, AVAILABLE, UNAVAILABLE] = range(1, 4)


const typeFreqs = [0, 1, 6, 4, 5, 5, 3, 2]

// Will modify `status`
function updateQuestStatus(quests, qid, status) {
  const quest = quests[qid]
  if (!quest) {
    return
  }
  quest.postquest.forEach((pid) => {
    const postq = quests[pid]
    if (!postq) {
      return
    }
    if (typeFreqs[quest.type] <= typeFreqs[postq.type] && status[postq.game_id] !== UNAVAILABLE) {
      status[postq.game_id] = UNAVAILABLE
      updateQuestStatus(quests, postq.game_id, status)
    }
  })
}

export default function reducer(state = initState, action) {
  const { type, body, postBody } = action
  switch (type) {
    case '@@poi-plugin-quest-info@init': {
      const reqstr = generateReqstr(action.__)
      const quests = keyBy(require(action.path), 'game_id')
      const questStatus = {}
      forEach(quests, (quest) => {
      // Initialize `quests`
        quest.postquest = quest.postquest || []
        quest.condition = reqstr(quest.requirements)
        if (typeof (quest.game_id) !== 'number') {
          console.warn(`Unexpected quest game_id type \"${typeof (quest.game_id)}\" for quest \"${quest.wiki_id}\"`)
          quest.game_id = `_UNKNOWN-${quests.length}`
        }
        quest.prerequisite.forEach((pid) => {
          if (typeof (pid) !== 'number') {
            console.warn(`Unexpected quest prerequisite type \"${typeof (pid)}\" for quest \"${quest.wiki_id}\". Skipping.`)
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
      // Initialize `questStatus`
        questStatus[quest.game_id] = COMPLETED
      })
      return {
        ...state,
        quests,
        questStatus,
      }
    }

    case '@@Response/kcsapi/api_get_member/questlist': {
      let questStatus = state.questStatus
      const quests = state.quests
      const statusBackup = questStatus
      forEach(body.api_list, (quest) => {
        // `quest` may be -1
        if (!quest || typeof quest !== 'object') {
          return
        }
        if (state.questStatus[quest.api_no] !== AVAILABLE) {
          questStatus = copyIfSame(questStatus, statusBackup)
          questStatus[quest.api_no] = AVAILABLE
          updateQuestStatus(quests, quest.api_no, questStatus)
        }
      })
      if (questStatus !== statusBackup) {
        return {
          ...state,
          questStatus,
        }
      }
      break
    }

    case '@@Response/kcsapi/api_req_quest/clearitemget': {
      const qid = parseInt(postBody.api_quest_id, 10)
      const quests = state.quests
      const questStatus = { ...state.questStatus }
      questStatus[qid] = 1
      get(quests, [qid, 'postquest'], []).forEach((postq) => {
        if (questStatus[postq] !== UNAVAILABLE) {
          return
        }
        const clearflag = get(quests, [postq, 'prerequisite'], []).every(prereq =>
        questStatus[prereq] === COMPLETED
      )
        if (clearflag) { questStatus[postq] = AVAILABLE }
      })
      return {
        ...state,
        questStatus,
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
