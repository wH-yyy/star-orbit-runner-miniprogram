// pages/home/home.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      avatar: '/images/avatar.png',
      name: '加载中...',
      studentId: '',
      campus: '',
      academy: '',
      className: ''
    },
    // 统计数据
    stats: [
      {
        value: '0 次',
        label: '打卡记录'
      },
      {
        value: '0 km',
        label: '累计里程'
      },
      {
        value: '0 天',
        label: '连续打卡'
      }
    ],
    // 菜单选项
    menuItems: [
      {
        id: 'edit',
        name: '个人信息',
        icon: ''
      },
      {
        id: 'awards',
        name: '我的奖项',
        icon: ''
      },
      {
        id: 'help',
        name: '帮助与反馈',
        icon: ''
      },
      {
        id: 'logout',
        name: '退出登录',
        icon: ''
      }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时重新加载用户信息（以防从编辑页面返回）
    this.loadUserInfo()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadUserInfo()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      // 从全局数据或本地存储获取用户学号
      const app = getApp()
      const studentId = app.globalData.userInfo?.studentId || wx.getStorageSync('studentId')
      
      if (!studentId) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/login/login'
          })
        }, 1500)
        return
      }
      
      // 从数据库获取用户信息
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .where({
          stu_id: studentId
        })
        .get()
      
      if (res.data.length > 0) {
        const userData = res.data[0]
        this.setData({
          userInfo: {
            avatar: '/images/avatar.png',
            name: userData.name,
            studentId: userData.stu_id,
            campus: userData.campus,
            academy: userData.college,
            className: userData.class_name
          }
        })
        
        // 更新全局用户信息
        if (app.globalData) {
          app.globalData.userInfo = {
            studentId: userData.stu_id,
            name: userData.name,
            gender: userData.gender,
            campus: userData.campus,
            className: userData.class_name,
            college: userData.college,
            phone: userData.phone
          }
        }
      } else {
        wx.showToast({
          title: '用户信息不存在',
          icon: 'none'
        })
      }
      
    } catch (error) {
      console.error('加载用户信息失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 跳转到编辑个人信息页面
   */
  navigateToUserInfo() {
    wx.navigateTo({
      url: '/pages/user-info/user-info'
    })
  },

  /**
   * 跳转到记录页面
   */
  navigateToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    })
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.clearStorageSync()
          
          // 清除全局数据
          const app = getApp()
          if (app.globalData) {
            app.globalData.userInfo = null
          }
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          
          // 跳转到登录页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            })
          }, 1500)
        }
      }
    })
  },

  /**
   * 菜单点击事件
   */
  handleMenuClick(e) {
    const id = e.currentTarget.dataset.id;
    switch(id) {
      case 'edit':
        // 跳转到编辑个人信息页面
        this.navigateToUserInfo();
        break;
      case 'awards':
        // 跳转到我的奖项页面
        wx.navigateTo({
          url: '/pages/awards/awards'
        })
        break;
      case 'help':
        // 跳转到帮助与反馈页面
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
        break;
      case 'logout':
        // 退出登录逻辑
        this.handleLogout();
        break;
      default:
        break;
    }
  }
})