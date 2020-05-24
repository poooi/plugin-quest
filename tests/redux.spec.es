import { join } from 'path'
import i18next from 'i18next'
import { each, mapValues } from 'lodash'
import { readQuestInfo } from '../redux'
import { addGlobalI18n, readI18nResources } from './fixtures/poi'

window.i18n = {}
window.LOCALES = [
  {
    locale: 'zh-CN',
    lng: '简体中文',
  },
  {
    locale: 'zh-TW',
    lng: '正體中文',
  },
  {
    locale: 'ja-JP',
    lng: '日本語',
  },
  {
    locale: 'en-US',
    lng: 'English',
  },
  {
    locale: 'ko-KR',
    lng: '한국어',
  },
]

const EXTENSION_KEY = 'poi-plugin-quest-info'
const NS = [EXTENSION_KEY, 'resources']

beforeEach(() => {
  i18next.init()
  i18next.addGlobalI18n = addGlobalI18n

  const namespace = EXTENSION_KEY
  const i18nFile = join('assets', 'i18n')

  each(
    window.LOCALES.map(lng => lng.locale),
    language => {
      i18next.addGlobalI18n(namespace)
      i18next.addResourceBundle(
        language,
        namespace,
        readI18nResources(join(i18nFile, `${language}.json`)),
        true,
        true,
      )
    },
  )
})

describe('readQuestInfo', () => {
  test.each(window.LOCALES.map(l => l.locale))(
    '%s should quests match snapshot',
    async lng => {
      window.language = lng
      const dataPath = join('assets', 'data.json')

      const __ = i18next.getFixedT(lng, NS)

      const dispatchMock = jest.fn(({ quests }) => {
        expect(
          mapValues(
            quests,
            // eslint-disable-next-line camelcase
            ({ condition, detail, game_id, name, postquest }) => ({
              condition,
              detail,
              game_id,
              name,
              postquest,
            }),
          ),
        ).toMatchSnapshot()
      })
      await readQuestInfo(dataPath, __)(dispatchMock)
      expect(dispatchMock).toBeCalledTimes(1)
    },
  )
})
