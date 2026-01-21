// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  // 获取参数
  const { date, location, images } = event
  
  try {
    // 验证参数
    if (!date || !images || images.length === 0) {
      return {
        code: 400,
        message: '参数错误，缺少必要字段',
        data: null
      }
    }
    
    // 插入跑步记录
    const result = await db.collection('RunningRecords').add({
      data: {
        userId: wxContext.OPENID,
        date: date,
        location: location || '',
        images: images,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    // 返回结果
    return {
      code: 200,
      message: '提交成功',
      data: {
        recordId: result._id
      }
    }
  } catch (error) {
    console.error('提交跑步记录失败:', error)
    return {
      code: 500,
      message: '服务器内部错误',
      data: null
    }
  }
}