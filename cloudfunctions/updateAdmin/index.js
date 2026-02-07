// 云函数：updateAdmin/index.js
const cloud = require('wx-server-sdk')
const bcrypt = require('bcryptjs')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { _id, username, password, real_name } = event
  
  console.log('收到更新管理员请求:', { _id, username, password: password?.length, real_name })
  
  if (!_id) {
    return {
      code: 400,
      success: false,
      message: '管理员ID不能为空'
    }
  }

  try {
    // 首先检查管理员是否存在
    const adminDoc = await db.collection('admin').doc(_id).get()
    if (!adminDoc.data) {
      return {
        code: 404,
        success: false,
        message: '管理员不存在'
      }
    }

    const currentAdmin = adminDoc.data
    const updateData = {}
    
    // 1. 更新用户名（如果提供）
    if (username !== undefined && username !== null) {
      // 检查用户名格式
      if (username.length < 3 || username.length > 20) {
        return {
          code: 400,
          success: false,
          message: '用户名长度应为3-20个字符'
        }
      }
      
      // 检查用户名是否与其他管理员重复（除了自己）
      if (username !== currentAdmin.username) {
        const checkResult = await db.collection('admin')
          .where({
            username: username
          })
          .get()
        
        if (checkResult.data.length > 0) {
          return {
            code: 409,
            success: false,
            message: `用户名 "${username}" 已存在`
          }
        }
      }
      
      updateData.username = username
    }
    
    // 2. 更新密码（如果提供）
    if (password !== undefined && password !== null) {
      if (password.length < 6) {
        return {
          code: 400,
          success: false,
          message: '密码长度至少6位'
        }
      }
      
      // 对密码进行哈希加密
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(password, saltRounds)
      updateData.password_hash = passwordHash
    }
    
    // 3. 更新真实姓名（如果提供）
    if (real_name !== undefined && real_name !== null) {
      if (real_name.trim() === '') {
        return {
          code: 400,
          success: false,
          message: '真实姓名不能为空'
        }
      }
      updateData.real_name = real_name.trim()
    }
    
    // 如果没有要更新的数据
    if (Object.keys(updateData).length === 0) {
      return {
        code: 400,
        success: false,
        message: '没有提供要更新的数据'
      }
    }
    
    // 添加更新时间
    updateData.updated_at = new Date()
    
    // 执行更新
    await db.collection('admin').doc(_id).update({
      data: updateData
    })
    
    console.log('管理员信息更新成功:', _id, updateData)
    
    // 获取更新后的数据
    const updatedDoc = await db.collection('admin').doc(_id).get()
    
    return {
      code: 200,
      success: true,
      message: '管理员信息更新成功',
      data: {
        _id: updatedDoc.data._id,
        username: updatedDoc.data.username,
        real_name: updatedDoc.data.real_name,
        status: updatedDoc.data.status,
        updated_at: updatedDoc.data.updated_at
      }
    }
  } catch (error) {
    console.error('更新管理员信息失败:', error)
    
    let errorMessage = '更新失败'
    if (error.errCode === -502006) {
      errorMessage = '记录不存在'
    } else if (error.errCode === -502005) {
      errorMessage = '数据库集合不存在'
    }
    
    return {
      code: 500,
      success: false,
      message: errorMessage,
      error: error.message
    }
  }
}