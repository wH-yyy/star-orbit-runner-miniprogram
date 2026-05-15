const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

const MODIFY_DEADLINE_HOUR = Number(process.env.MODIFY_DEADLINE_HOUR )
const MODIFY_DEADLINE_MINUTE = Number(process.env.MODIFY_DEADLINE_MINUTE )

function getBeijingNow() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  return new Date(utc + 8 * 60 * 60 * 1000)
}

function getModifyDeadline(createTime) {
  const created = new Date(createTime)
  const utc = created.getTime() + created.getTimezoneOffset() * 60 * 1000
  const beijingCreated = new Date(utc + 8 * 60 * 60 * 1000)

  const deadline = new Date(beijingCreated)
  deadline.setDate(deadline.getDate() + 1)
  deadline.setHours(MODIFY_DEADLINE_HOUR, MODIFY_DEADLINE_MINUTE, 0, 0)

  return deadline
}

async function deleteCloudFile(fileID) {
  if (!fileID) return
  try {
    await cloud.deleteFile({
      fileList: [fileID]
    })
  } catch (error) {
    console.error('deleteCloudFile failed:', error)
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { recordId, newImageFileID, newStepImageFileID, newMode } = event
  const allowedModes = ['全程在操场', '在任意场地跑，提供步数截图']

  if (!recordId) {
    return {
      code: 400,
      message: '缺少 recordId',
      data: null
    }
  }

  if (!newImageFileID && !newStepImageFileID && !newMode) {
    return {
      code: 400,
      message: '至少需要修改图片、步数截图或跑步方式',
      data: null
    }
  }

  if (newMode && !allowedModes.includes(newMode)) {
    return {
      code: 400,
      message: '跑步方式不合法',
      data: null
    }
  }

  try {
    const recordRes = await db.collection('RunningRecords').doc(recordId).get()
    const record = recordRes.data

    if (!record) {
      return {
        code: 404,
        message: '记录不存在',
        data: null
      }
    }

    if (record.openid !== openid) {
      return {
        code: 403,
        message: '无权修改该记录',
        data: null
      }
    }

    if (record.status !== 0) {
      return {
        code: 409,
        message: '已审核记录不可修改',
        data: null
      }
    }

    if (!record.create_time) {
      return {
        code: 410,
        message: '记录时间异常，无法修改',
        data: null
      }
    }

    const now = getBeijingNow()
    const deadline = getModifyDeadline(record.create_time)

    if (now.getTime() > deadline.getTime()) {
      return {
        code: 411,
        message: '已超过修改截止时间',
        data: null
      }
    }

    const targetMode = newMode || record.mode || allowedModes[0]
    const isTrackMode = targetMode === allowedModes[0]
    const finalStepImageFileID = isTrackMode ? '' : (newStepImageFileID || record.stepImageFileID || '')

    if (targetMode === allowedModes[1] && !finalStepImageFileID) {
      return {
        code: 412,
        message: '修改为任意场地跑时必须提供步数截图',
        data: null
      }
    }

    const oldImageFileID = record.imageFileID || ''
    const oldStepImageFileID = record.stepImageFileID || ''
    const updateData = {
      last_modify_time: db.serverDate(),
      is_modified: true
    }

    if (newImageFileID) {
      updateData.imageFileID = newImageFileID
    }

    if (typeof newStepImageFileID === 'string' && newStepImageFileID) {
      updateData.stepImageFileID = newStepImageFileID
    }

    if (isTrackMode) {
      updateData.stepImageFileID = ''
    }

    if (newMode) {
      updateData.mode = newMode
    }

    await db.collection('RunningRecords').doc(recordId).update({
      data: updateData
    })

    if (newImageFileID && oldImageFileID && oldImageFileID !== newImageFileID) {
      await deleteCloudFile(oldImageFileID)
    }

    if (newStepImageFileID && oldStepImageFileID && oldStepImageFileID !== newStepImageFileID) {
      await deleteCloudFile(oldStepImageFileID)
    }

    if (isTrackMode && oldStepImageFileID) {
      await deleteCloudFile(oldStepImageFileID)
    }

    return {
      code: 200,
      message: '记录修改成功',
      data: {
        recordId,
        imageFileID: newImageFileID || record.imageFileID,
        stepImageFileID: finalStepImageFileID,
        mode: newMode || record.mode
      }
    }
  } catch (error) {
    console.error('updateRunningRecordImage error:', error)
    return {
      code: 500,
      message: `服务器错误: ${error.message}`,
      data: null
    }
  }
}
