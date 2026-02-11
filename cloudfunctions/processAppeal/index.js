// cloudfunctions/processAppeal/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 解析时间字符串 "HH:MM:SS" 为时长对象
 * @param {string} durationStr - 如 "00:12:27"
 * @returns {{hour: number, minute: number, second: number}}
 */
function parseDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') {
    return { hour: 0, minute: 0, second: 0 }
  }
  
  const parts = durationStr.split(':')
  if (parts.length === 3) {
    const hour = parseInt(parts[0]) || 0
    const minute = parseInt(parts[1]) || 0
    const second = parseInt(parts[2]) || 0
    return { hour, minute, second }
  } else if (parts.length === 2) {
    // 支持 "MM:SS" 格式
    const minute = parseInt(parts[0]) || 0
    const second = parseInt(parts[1]) || 0
    return { hour: 0, minute, second }
  }
  return { hour: 0, minute: 0, second: 0 }
}

/**
 * 将两个时长对象相加，自动处理进位
 * @param {{hour: number, minute: number, second: number}} a
 * @param {{hour: number, minute: number, second: number}} b
 * @returns {{hour: number, minute: number, second: number}}
 */
function addDuration(a, b) {
  let second = a.second + b.second
  let minute = a.minute + b.minute
  let hour = a.hour + b.hour

  // 秒进位到分
  if (second >= 60) {
    minute += Math.floor(second / 60)
    second = second % 60
  }
  // 分进位到时
  if (minute >= 60) {
    hour += Math.floor(minute / 60)
    minute = minute % 60
  }

  return { hour, minute, second }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { appealId, result, auditResult, staffName, staffId } = event
    
    if (!appealId || result === undefined || !auditResult || !staffName || !staffId) {
      return {
        code: 400,
        data: null,
        message: '参数不完整'
      }
    }
    
    // 验证结果值
    if (![1, 2].includes(result)) {
      return {
        code: 400,
        data: null,
        message: '处理结果无效，1为通过，2为不通过'
      }
    }
    
    // 获取申诉记录
    const appealResult = await db.collection('Appeals').doc(appealId).get()
    
    if (!appealResult.data) {
      return {
        code: 404,
        data: null,
        message: '申诉记录不存在'
      }
    }
    
    const appeal = appealResult.data
    
    // 检查申诉状态，防止重复处理
    if (appeal.status !== 0) {
      return {
        code: 400,
        data: null,
        message: '该申诉已处理，不可重复处理'
      }
    }
    
    // --- 权限验证：检查该申诉对应的跑步记录是否分配给当前工作人员 ---
    if (appeal.runningRecordId) {
      const runningRecordResult = await db.collection('RunningRecords')
        .doc(appeal.runningRecordId)
        .get()
      
      if (runningRecordResult.data) {
        const runningRecord = runningRecordResult.data
        if (runningRecord.assignedStaffId !== staffId) {
          return {
            code: 403,
            data: null,
            message: '您无权处理此申诉，该申诉由其他工作人员负责'
          }
        }
      }
    }
    // --------------------------------------------------------------
    
    const now = new Date()
    
    // 开始事务处理
    const transaction = await db.startTransaction()
    
    try {
      // 1. 更新申诉记录
      await transaction.collection('Appeals').doc(appealId).update({
        data: {
          status: result,
          auditResult: auditResult,
          auditTime: now,
          auditor: staffName
        }
      })
      
      // 2. 获取跑步记录详情
      let runningRecord = null
      if (appeal.runningRecordId) {
        const recordResult = await transaction.collection('RunningRecords')
          .doc(appeal.runningRecordId)
          .get()
        runningRecord = recordResult.data
      }
      
      // 3. 更新跑步记录状态
      const runningRecordStatus = result === 1 ? 1 : 2
      await transaction.collection('RunningRecords').doc(appeal.runningRecordId).update({
        data: {
          status: runningRecordStatus,
          audit_reason: result === 1 ? "申诉通过" : auditResult
        }
      })
      
      // 4. 如果申诉通过，更新用户数据
      if (result === 1 && runningRecord) {
        // 4.1 根据学号查找用户
        const userQuery = await transaction.collection('Users')
          .where({
            stu_id: appeal.stu_id
          })
          .get()
        
        if (userQuery.data.length > 0) {
          const user = userQuery.data[0]
          
          // 4.2 解析本次跑步的时长
          const durationObj = parseDuration(runningRecord.running_duration)
          
          // 4.3 获取当前用户的 totalDuration，若不存在则初始化为 {hour:0,minute:0,second:0}
          const currentDuration = user.totalDuration || { hour: 0, minute: 0, second: 0 }
          
          // 4.4 计算新的总时长
          const newDuration = addDuration(currentDuration, durationObj)
          
          // 4.5 准备更新数据
          const updateData = {
            totalDistance: _.inc(parseFloat(runningRecord.running_distance) || 0),
            totalCount: _.inc(1),
            totalDuration: newDuration,  // 直接设置新对象
            updateTime: now
          }
          
          // 4.6 执行更新
          await transaction.collection('Users').doc(user._id).update({
            data: updateData
          })
          
          console.log(`用户数据更新成功: stu_id=${appeal.stu_id}, 增加距离=${runningRecord.running_distance}km, 增加时长=${runningRecord.running_duration}, 新总时长=${JSON.stringify(newDuration)}`)
        } else {
          console.warn(`用户记录不存在: stu_id=${appeal.stu_id}`)
        }
      }
      
      // 提交事务
      await transaction.commit()
      
      console.log(`申诉处理成功: appealId=${appealId}, result=${result}`)
      
      return {
        code: 200,
        data: {
          appealId,
          runningRecordId: appeal.runningRecordId,
          result,
          auditTime: now.toISOString(),
          userUpdated: result === 1
        },
        message: '申诉处理成功' + (result === 1 ? '，用户数据已更新' : '')
      }
    } catch (transactionError) {
      await transaction.rollback()
      console.error('事务处理失败:', transactionError)
      throw transactionError
    }
  } catch (error) {
    console.error('处理申诉失败:', error)
    return {
      code: 500,
      data: null,
      message: '处理申诉失败: ' + error.message
    }
  }
}