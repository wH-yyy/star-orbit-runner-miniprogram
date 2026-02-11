// cloudfunctions/processAppeal/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 辅助函数：将时间字符串转换为分钟数
function durationToMinutes(durationStr) {
  if (!durationStr) return 0
  
  try {
    // 处理格式如 "00:12:27" 的时间字符串
    const parts = durationStr.split(':')
    
    if (parts.length === 3) {
      // HH:MM:SS 格式
      const hours = parseInt(parts[0]) || 0
      const minutes = parseInt(parts[1]) || 0
      const seconds = parseInt(parts[2]) || 0
      
      // 转换为分钟数（保留2位小数）
      return parseFloat((hours * 60 + minutes + seconds / 60).toFixed(2))
    } else if (parts.length === 2) {
      // MM:SS 格式
      const minutes = parseInt(parts[0]) || 0
      const seconds = parseInt(parts[1]) || 0
      
      return parseFloat((minutes + seconds / 60).toFixed(2))
    } else {
      // 尝试直接转换为数字
      return parseFloat(durationStr) || 0
    }
  } catch (error) {
    console.error('时间转换失败:', durationStr, error)
    return 0
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { appealId, result, auditResult, staffName } = event

        const staffId = event.staffId

        console.log("当前工作人员的staffId = ", staffId)

        if (!staffId) {
          return {
            code: 401,
            data: null,
            message: '无法获取工作人员身份标识'
          }
        }
    
    if (!appealId || result === undefined || !auditResult || !staffName) {
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

    // 检查权限：验证工作人员是否有权处理该申诉
    if (appeal.runningRecordId) {
      // 获取对应的跑步记录
      const runningRecordResult = await db.collection('RunningRecords')
        .doc(appeal.runningRecordId)
        .get()
      
      if (runningRecordResult.data) {
        const runningRecord = runningRecordResult.data
        
        // 验证工作人员是否有权限处理
        if (runningRecord.assignedStaffId !== staffId) {
          return {
            code: 403,
            data: null,
            message: '您无权处理此申诉，该申诉由其他工作人员负责'
          }
        }
      }
    }
    
    const now = new Date()
    const auditTime = now.toISOString()
    
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
        const recordResult = await transaction.collection('RunningRecords').doc(appeal.runningRecordId).get()
        runningRecord = recordResult.data
      }
      
      // 3. 更新跑步记录状态
      // 申诉通过 => 跑步记录状态设为 1（通过）
      // 申诉不通过 => 跑步记录状态设为 2（不通过）
      const runningRecordStatus = result === 1 ? 1 : 2
      
      await transaction.collection('RunningRecords').doc(appeal.runningRecordId).update({
        data: {
          status: runningRecordStatus,
          audit_reason: result === 1 ? "申诉通过" : auditResult
        }
      })

      // 4. 如果申诉通过，更新用户数据
      if (result === 1 && runningRecord) {
        // 获取用户记录
        const userQuery = await transaction.collection('Users')
          .where({
            stu_id: appeal.stu_id
          })
          .get()
        
        if (userQuery.data.length > 0) {
          const user = userQuery.data[0]
          
          // 计算跑步距离（确保是数字）
          const runningDistance = parseFloat(runningRecord.running_distance) || 0
          
          // 计算跑步时长（转换为分钟数）
          const runningDurationMinutes = durationToMinutes(runningRecord.running_duration)
          
          // 更新用户数据
          await transaction.collection('Users').doc(user._id).update({
            data: {
              totalDistance: _.inc(runningDistance),
              totalDuration: _.inc(runningDurationMinutes),
              totalCount: _.inc(1),
              updateTime: now
            }
          })
          
          console.log(`用户数据更新成功: stu_id=${appeal.stu_id}, 增加距离=${runningDistance}km, 增加时长=${runningDurationMinutes}min`)
        } else {
          console.warn(`用户记录不存在: stu_id=${appeal.stu_id}`)
        }
      }
      
      // 提交事务
      await transaction.commit()
      
      console.log(`申诉处理成功: appealId=${appealId}, result=${result}, 用户更新=${result === 1 ? '是' : '否'}`)
      
      return {
        code: 200,
        data: {
          appealId,
          runningRecordId: appeal.runningRecordId,
          result,
          auditTime,
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